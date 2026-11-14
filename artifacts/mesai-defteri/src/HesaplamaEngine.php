<?php

declare(strict_types=1);

/**
 * Simplified net-to-gross and overtime payroll calculations for the app.
 *
 * Amounts are converted to kuruş at the input boundary. Every deduction and
 * bracket-tax calculation is rounded to the nearest kuruş (half up).
 */
final class HesaplamaEngine
{
    public const TAX_YEAR = 2026;

    private const SGK_AND_UNEMPLOYMENT_RATE = 0.15;
    private const STAMP_TAX_RATE = 0.00759;

    /**
     * 2026 wage-income thresholds from the Revenue Administration (GİB).
     * Values are annual cumulative taxable wage income in kuruş.
     *
     * @var list<array{limit: int, rate: float}>
     */
    private const WAGE_TAX_BRACKETS = [
        ['limit' => 19_000_000, 'rate' => 0.15],
        ['limit' => 40_000_000, 'rate' => 0.20],
        ['limit' => 150_000_000, 'rate' => 0.27],
        ['limit' => 530_000_000, 'rate' => 0.35],
        ['limit' => PHP_INT_MAX, 'rate' => 0.40],
    ];

    /**
     * @param array{
     *   netSalary?: int|float|string,
     *   daysInMonth?: int|string,
     *   dailyHours?: int|float|string,
     *   cumulativeTaxBase?: int|float|string,
     *   entries?: list<array{id?: string, type: string, hours: int|float|string}>
     * } $input
     * @return array{
     *   monthlyGrossSalary: float,
     *   hourlyGross: float,
     *   totalHours: float,
     *   grossTotal: float,
     *   sgk: float,
     *   incomeTaxBase: float,
     *   incomeTax: float,
     *   stampTax: float,
     *   netTotal: float,
     *   taxYear: int
     * }
     */
    public function calculate(array $input): array
    {
        $netSalary = $this->toKurus($input['netSalary'] ?? 65_000, 'netSalary', 0, 10_000_000);
        $cumulativeTaxBase = $this->toKurus(
            $input['cumulativeTaxBase'] ?? 0,
            'cumulativeTaxBase',
            0,
            1_000_000_000,
        );

        $daysInMonth = filter_var($input['daysInMonth'] ?? null, FILTER_VALIDATE_INT);
        if ($daysInMonth === false || $daysInMonth < 28 || $daysInMonth > 31) {
            throw new InvalidArgumentException('daysInMonth must be an integer from 28 to 31.');
        }

        $dailyHours = $this->toDecimal($input['dailyHours'] ?? 7.5, 'dailyHours', 1, 24);
        $entries = $input['entries'] ?? [];
        if (!is_array($entries) || count($entries) > 1_500) {
            throw new InvalidArgumentException('entries must be an array with at most 1500 rows.');
        }

        $monthlyGrossCents = $this->grossSalaryForNet($netSalary, $cumulativeTaxBase);
        $monthlySgkCents = $this->roundedRate($monthlyGrossCents, self::SGK_AND_UNEMPLOYMENT_RATE);
        $monthlyTaxableBaseCents = $monthlyGrossCents - $monthlySgkCents;

        $monthlyHours = $daysInMonth * $dailyHours;
        $hourlyGrossCents = $monthlyGrossCents / $monthlyHours;
        $grossOvertimeCents = 0;
        $totalHours = 0.0;

        $multipliers = [
            'normal' => 1.5,
            'holiday' => 1.0,
            'bayram' => 2.0,
        ];

        foreach ($entries as $index => $entry) {
            if (!is_array($entry)) {
                throw new InvalidArgumentException("entries[$index] must be an object.");
            }

            $type = $entry['type'] ?? '';
            if (!is_string($type) || !array_key_exists($type, $multipliers)) {
                throw new InvalidArgumentException("entries[$index].type must be normal, holiday, or bayram.");
            }

            $hours = $this->toDecimal($entry['hours'] ?? null, "entries[$index].hours", 0, 24);
            $totalHours += $hours;
            $grossOvertimeCents += (int) round(
                $hourlyGrossCents * $multipliers[$type] * $hours,
                0,
                PHP_ROUND_HALF_UP,
            );
        }

        $grossOvertimeCents = max(0, $grossOvertimeCents);
        $sgkCents = $this->roundedRate($grossOvertimeCents, self::SGK_AND_UNEMPLOYMENT_RATE);
        $incomeTaxBaseCents = $grossOvertimeCents - $sgkCents;
        $taxBaseBeforeOvertimeCents = $cumulativeTaxBase + $monthlyTaxableBaseCents;
        $incomeTaxCents = $this->taxOnAdditionalBase($taxBaseBeforeOvertimeCents, $incomeTaxBaseCents);
        $stampTaxCents = $this->roundedRate($grossOvertimeCents, self::STAMP_TAX_RATE);
        $netOvertimeCents = $grossOvertimeCents - $sgkCents - $incomeTaxCents - $stampTaxCents;

        return [
            'monthlyGrossSalary' => $this->fromKurus($monthlyGrossCents),
            'hourlyGross' => round($hourlyGrossCents / 100, 2, PHP_ROUND_HALF_UP),
            'totalHours' => round($totalHours, 2, PHP_ROUND_HALF_UP),
            'grossTotal' => $this->fromKurus($grossOvertimeCents),
            'sgk' => $this->fromKurus($sgkCents),
            'incomeTaxBase' => $this->fromKurus($incomeTaxBaseCents),
            'incomeTax' => $this->fromKurus($incomeTaxCents),
            'stampTax' => $this->fromKurus($stampTaxCents),
            'netTotal' => $this->fromKurus($netOvertimeCents),
            'taxYear' => self::TAX_YEAR,
        ];
    }

    private function grossSalaryForNet(int $targetNetCents, int $cumulativeTaxBaseCents): int
    {
        $low = 0;
        $high = max($targetNetCents * 2, 1_000_000);

        while ($this->netSalaryFromGross($high, $cumulativeTaxBaseCents) < $targetNetCents) {
            $high *= 2;
            if ($high > 100_000_000_000) {
                throw new InvalidArgumentException('The requested net salary is outside the supported range.');
            }
        }

        while ($low < $high) {
            $middle = intdiv($low + $high, 2);
            if ($this->netSalaryFromGross($middle, $cumulativeTaxBaseCents) < $targetNetCents) {
                $low = $middle + 1;
            } else {
                $high = $middle;
            }
        }

        $candidates = [$low, max(0, $low - 1)];
        usort($candidates, function (int $left, int $right) use ($targetNetCents, $cumulativeTaxBaseCents): int {
            $leftDifference = abs($this->netSalaryFromGross($left, $cumulativeTaxBaseCents) - $targetNetCents);
            $rightDifference = abs($this->netSalaryFromGross($right, $cumulativeTaxBaseCents) - $targetNetCents);

            return $leftDifference <=> $rightDifference ?: $left <=> $right;
        });

        return $candidates[0];
    }

    private function netSalaryFromGross(int $grossCents, int $cumulativeTaxBaseCents): int
    {
        $sgkCents = $this->roundedRate($grossCents, self::SGK_AND_UNEMPLOYMENT_RATE);
        $taxableBaseCents = $grossCents - $sgkCents;
        $incomeTaxCents = $this->taxOnAdditionalBase($cumulativeTaxBaseCents, $taxableBaseCents);
        $stampTaxCents = $this->roundedRate($grossCents, self::STAMP_TAX_RATE);

        return $grossCents - $sgkCents - $incomeTaxCents - $stampTaxCents;
    }

    private function taxOnAdditionalBase(int $cumulativeBaseCents, int $additionalBaseCents): int
    {
        if ($additionalBaseCents <= 0) {
            return 0;
        }

        return max(
            0,
            $this->progressiveTax($cumulativeBaseCents + $additionalBaseCents)
                - $this->progressiveTax($cumulativeBaseCents),
        );
    }

    private function progressiveTax(int $cumulativeBaseCents): int
    {
        $remainingBase = max(0, $cumulativeBaseCents);
        $previousLimit = 0;
        $taxCents = 0;

        foreach (self::WAGE_TAX_BRACKETS as $bracket) {
            $taxableInBracket = min($remainingBase, $bracket['limit']) - $previousLimit;
            if ($taxableInBracket > 0) {
                $taxCents += $this->roundedRate($taxableInBracket, $bracket['rate']);
            }

            if ($remainingBase <= $bracket['limit']) {
                break;
            }
            $previousLimit = $bracket['limit'];
        }

        return $taxCents;
    }

    private function roundedRate(int $amountCents, float $rate): int
    {
        return (int) round($amountCents * $rate, 0, PHP_ROUND_HALF_UP);
    }

    private function toKurus(mixed $value, string $field, float $minimum, float $maximum): int
    {
        $decimal = $this->toDecimal($value, $field, $minimum, $maximum);

        return (int) round($decimal * 100, 0, PHP_ROUND_HALF_UP);
    }

    private function toDecimal(mixed $value, string $field, float $minimum, float $maximum): float
    {
        if (!is_int($value) && !is_float($value) && !is_string($value)) {
            throw new InvalidArgumentException("$field must be a number.");
        }
        if (!is_numeric($value)) {
            throw new InvalidArgumentException("$field must be a number.");
        }

        $decimal = (float) $value;
        if (!is_finite($decimal) || $decimal < $minimum || $decimal > $maximum) {
            throw new InvalidArgumentException("$field must be between $minimum and $maximum.");
        }

        return $decimal;
    }

    private function fromKurus(int $amountCents): float
    {
        return round($amountCents / 100, 2, PHP_ROUND_HALF_UP);
    }
}
