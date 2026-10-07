<?php

namespace App\Services;

use InvalidArgumentException;

/**
 * QR Code model 2, byte mode, error correction level L, mask 0.
 *
 * The symbol encodes a URL. Traceability data stays on the public page.
 * Versions 1 through 6 cover the lot URLs used by this demo.
 */
final class QrCode
{
    /**
     * Error correction level L is 0b01.
     */
    private const ECC_LEVEL = 1;

    /**
     * Data codewords, EC codewords per block, and block count for level L.
     *
     * @var array<int, array{0: int, 1: int, 2: int}>
     */
    private const VERSIONS = [
        1 => [19, 7, 1],
        2 => [34, 10, 1],
        3 => [55, 15, 1],
        4 => [80, 20, 1],
        5 => [108, 26, 1],
        6 => [136, 18, 2],
    ];

    /**
     * @var array<int, list<int>>
     */
    private const ALIGNMENT = [
        1 => [],
        2 => [6, 18],
        3 => [6, 22],
        4 => [6, 26],
        5 => [6, 30],
        6 => [6, 34],
    ];

    /**
     * @var array<int, int>
     */
    private const REMAINDER_BITS = [
        1 => 0,
        2 => 7,
        3 => 7,
        4 => 7,
        5 => 7,
        6 => 7,
    ];

    /** @var list<int> */
    private array $exp = [];

    /** @var list<int> */
    private array $log = [];

    public function svg(string $text): string
    {
        $modules = $this->modules($text);
        $size = count($modules);
        $quiet = 4;
        $dimension = $size + ($quiet * 2);
        $path = '';

        foreach ($modules as $y => $row) {
            foreach ($row as $x => $dark) {
                if ($dark) {
                    $path .= 'M'.($x + $quiet).' '.($y + $quiet).'h1v1h-1z';
                }
            }
        }

        return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 '.$dimension.' '.$dimension.'" shape-rendering="crispEdges" role="img">'
            .'<rect width="100%" height="100%" fill="#fff"/>'
            .'<path fill="#1c1917" d="'.$path.'"/>'
            .'</svg>';
    }

    /**
     * Dark modules, without the quiet zone. True is dark.
     *
     * @return list<list<bool>>
     */
    public function modules(string $text): array
    {
        if ($text === '') {
            throw new InvalidArgumentException('QR text is empty.');
        }

        $version = $this->version(strlen($text));
        [$dataCodewords, $ecCodewords, $blocks] = self::VERSIONS[$version];
        $size = 21 + (($version - 1) * 4);
        $codewords = $this->codewords($text, $version, $dataCodewords, $ecCodewords, $blocks);
        $functions = array_fill(0, $size, array_fill(0, $size, false));
        $modules = array_fill(0, $size, array_fill(0, $size, false));

        $this->drawFinders($modules, $functions, $size);
        $this->drawTiming($modules, $functions, $size);
        $this->drawAlignment($modules, $functions, $version, $size);
        $this->reserveFormat($functions, $size);
        $functions[4 * $version + 9][8] = true;
        $modules[4 * $version + 9][8] = true;

        $this->drawData($modules, $functions, $codewords, self::REMAINDER_BITS[$version]);
        $this->applyMask($modules, $functions);
        $this->drawFormat($modules, $size, $this->formatBits(0));

        return $modules;
    }

    /**
     * 15-bit format information for error correction level L and a mask.
     */
    public function formatBits(int $mask): int
    {
        $data = (self::ECC_LEVEL << 3) | $mask;
        $remainder = $data;

        for ($i = 0; $i < 10; $i++) {
            $remainder = ($remainder << 1) ^ ((($remainder >> 9) & 1) * 0x537);
        }

        return (($data << 10) | ($remainder & 0x3FF)) ^ 0x5412;
    }

    private function version(int $length): int
    {
        foreach (self::VERSIONS as $version => [$dataCodewords]) {
            $countBits = $version <= 9 ? 8 : 16;

            if (intdiv(($dataCodewords * 8) - 4 - $countBits, 8) >= $length) {
                return $version;
            }
        }

        throw new InvalidArgumentException('The traceability URL is too long for a QR code.');
    }

    /**
     * @return list<int>
     */
    private function codewords(string $text, int $version, int $dataCodewords, int $ecCodewords, int $blocks): array
    {
        $bits = array_merge([0, 1, 0, 0], $this->bitsOf(strlen($text), $version <= 9 ? 8 : 16));

        foreach (array_values(unpack('C*', $text) ?: []) as $byte) {
            $bits = array_merge($bits, $this->bitsOf($byte, 8));
        }

        $capacity = $dataCodewords * 8;
        $terminator = min(4, $capacity - count($bits));

        for ($i = 0; $i < $terminator; $i++) {
            $bits[] = 0;
        }

        while ((count($bits) % 8) !== 0) {
            $bits[] = 0;
        }

        $bytes = [];

        for ($i = 0; $i < count($bits); $i += 8) {
            $byte = 0;

            for ($bit = 0; $bit < 8; $bit++) {
                $byte = ($byte << 1) | $bits[$i + $bit];
            }

            $bytes[] = $byte;
        }

        $pad = 0xEC;

        while (count($bytes) < $dataCodewords) {
            $bytes[] = $pad;
            $pad = $pad === 0xEC ? 0x11 : 0xEC;
        }

        return $this->interleave($bytes, $ecCodewords, $blocks);
    }

    /**
     * @param  list<int>  $data
     * @return list<int>
     */
    private function interleave(array $data, int $ecCodewords, int $blocks): array
    {
        $blockSize = intdiv(count($data), $blocks);
        $dataBlocks = array_chunk($data, $blockSize);
        $ecBlocks = [];

        foreach ($dataBlocks as $block) {
            $ecBlocks[] = $this->remainder($block, $ecCodewords);
        }

        $result = [];

        for ($i = 0; $i < $blockSize; $i++) {
            foreach ($dataBlocks as $block) {
                $result[] = $block[$i];
            }
        }

        for ($i = 0; $i < $ecCodewords; $i++) {
            foreach ($ecBlocks as $block) {
                $result[] = $block[$i];
            }
        }

        return $result;
    }

    /**
     * @param  list<int>  $data
     * @return list<int>
     */
    private function remainder(array $data, int $ecCount): array
    {
        $this->bootField();
        $generator = [1];

        for ($i = 0; $i < $ecCount; $i++) {
            $generator = $this->multiply($generator, [1, $this->exp[$i]]);
        }

        $result = array_merge($data, array_fill(0, $ecCount, 0));

        foreach ($data as $i => $ignored) {
            $coefficient = $result[$i];

            if ($coefficient === 0) {
                continue;
            }

            foreach ($generator as $j => $term) {
                $result[$i + $j] ^= $this->multiplyBytes($term, $coefficient);
            }
        }

        return array_slice($result, -$ecCount);
    }

    /**
     * @param  list<int>  $left
     * @param  list<int>  $right
     * @return list<int>
     */
    private function multiply(array $left, array $right): array
    {
        $product = array_fill(0, count($left) + count($right) - 1, 0);

        foreach ($left as $i => $a) {
            foreach ($right as $j => $b) {
                $product[$i + $j] ^= $this->multiplyBytes($a, $b);
            }
        }

        return $product;
    }

    private function multiplyBytes(int $a, int $b): int
    {
        if ($a === 0 || $b === 0) {
            return 0;
        }

        return $this->exp[$this->log[$a] + $this->log[$b]];
    }

    private function bootField(): void
    {
        if ($this->exp !== []) {
            return;
        }

        $this->exp = array_fill(0, 512, 0);
        $this->log = array_fill(0, 256, 0);
        $value = 1;

        for ($i = 0; $i < 255; $i++) {
            $this->exp[$i] = $value;
            $this->log[$value] = $i;
            $value <<= 1;

            if (($value & 0x100) !== 0) {
                $value ^= 0x11D;
            }
        }

        for ($i = 255; $i < 512; $i++) {
            $this->exp[$i] = $this->exp[$i - 255];
        }
    }

    /**
     * @param  list<list<bool>>  $modules
     * @param  list<list<bool>>  $functions
     */
    private function drawFinders(array &$modules, array &$functions, int $size): void
    {
        foreach ([[0, 0], [$size - 7, 0], [0, $size - 7]] as [$row, $col]) {
            for ($y = -1; $y <= 7; $y++) {
                for ($x = -1; $x <= 7; $x++) {
                    $yy = $row + $y;
                    $xx = $col + $x;

                    if ($yy < 0 || $xx < 0 || $yy >= $size || $xx >= $size) {
                        continue;
                    }

                    $functions[$yy][$xx] = true;
                    $dark = $x >= 0 && $x <= 6 && $y >= 0 && $y <= 6
                        && ($x === 0 || $x === 6 || $y === 0 || $y === 6 || ($x >= 2 && $x <= 4 && $y >= 2 && $y <= 4));
                    $modules[$yy][$xx] = $dark;
                }
            }
        }
    }

    /**
     * @param  list<list<bool>>  $modules
     * @param  list<list<bool>>  $functions
     */
    private function drawTiming(array &$modules, array &$functions, int $size): void
    {
        for ($i = 8; $i < $size - 8; $i++) {
            $dark = ($i % 2) === 0;
            $modules[6][$i] = $dark;
            $modules[$i][6] = $dark;
            $functions[6][$i] = true;
            $functions[$i][6] = true;
        }
    }

    /**
     * @param  list<list<bool>>  $modules
     * @param  list<list<bool>>  $functions
     */
    private function drawAlignment(array &$modules, array &$functions, int $version, int $size): void
    {
        foreach (self::ALIGNMENT[$version] as $row) {
            foreach (self::ALIGNMENT[$version] as $col) {
                if ($this->overlapsFinder($row, $col, $size)) {
                    continue;
                }

                for ($y = -2; $y <= 2; $y++) {
                    for ($x = -2; $x <= 2; $x++) {
                        $functions[$row + $y][$col + $x] = true;
                        $modules[$row + $y][$col + $x] = max(abs($x), abs($y)) !== 1;
                    }
                }
            }
        }
    }

    private function overlapsFinder(int $row, int $col, int $size): bool
    {
        $top = $row <= 8;
        $bottom = $row >= $size - 9;
        $left = $col <= 8;
        $right = $col >= $size - 9;

        return ($top && $left) || ($top && $right) || ($bottom && $left);
    }

    /**
     * @param  list<list<bool>>  $functions
     */
    private function reserveFormat(array &$functions, int $size): void
    {
        for ($i = 0; $i < 9; $i++) {
            $functions[8][$i] = true;
            $functions[$i][8] = true;
        }

        for ($i = 0; $i < 8; $i++) {
            $functions[8][$size - 1 - $i] = true;
            $functions[$size - 1 - $i][8] = true;
        }
    }

    /**
     * @param  list<list<bool>>  $modules
     * @param  list<list<bool>>  $functions
     * @param  list<int>  $codewords
     */
    private function drawData(array &$modules, array &$functions, array $codewords, int $remainderBits): void
    {
        $bits = [];

        foreach ($codewords as $byte) {
            $bits = array_merge($bits, $this->bitsOf($byte, 8));
        }

        for ($i = 0; $i < $remainderBits; $i++) {
            $bits[] = 0;
        }

        $size = count($modules);
        $index = 0;

        for ($right = $size - 1; $right >= 1; $right -= 2) {
            if ($right === 6) {
                $right = 5;
            }

            for ($vert = 0; $vert < $size; $vert++) {
                for ($j = 0; $j < 2; $j++) {
                    $x = $right - $j;
                    $upward = (($right + 1) & 2) === 0;
                    $y = $upward ? $size - 1 - $vert : $vert;

                    if ($functions[$y][$x] || $index >= count($bits)) {
                        continue;
                    }

                    $modules[$y][$x] = $bits[$index] === 1;
                    $index++;
                }
            }
        }
    }

    /**
     * @param  list<list<bool>>  $modules
     * @param  list<list<bool>>  $functions
     */
    private function applyMask(array &$modules, array $functions): void
    {
        $size = count($modules);

        for ($y = 0; $y < $size; $y++) {
            for ($x = 0; $x < $size; $x++) {
                if (! $functions[$y][$x] && (($x + $y) % 2) === 0) {
                    $modules[$y][$x] = ! $modules[$y][$x];
                }
            }
        }
    }

    /**
     * @param  list<list<bool>>  $modules
     */
    private function drawFormat(array &$modules, int $size, int $bits): void
    {
        $bit = function (int $index) use ($bits): bool {
            return (($bits >> $index) & 1) === 1;
        };

        for ($i = 0; $i <= 5; $i++) {
            $modules[$i][8] = $bit($i);
        }

        $modules[7][8] = $bit(6);
        $modules[8][8] = $bit(7);
        $modules[8][7] = $bit(8);

        for ($i = 9; $i < 15; $i++) {
            $modules[8][14 - $i] = $bit($i);
        }

        for ($i = 0; $i < 8; $i++) {
            $modules[8][$size - 1 - $i] = $bit($i);
        }

        for ($i = 8; $i < 15; $i++) {
            $modules[$size - 15 + $i][8] = $bit($i);
        }

        $modules[$size - 8][8] = true;
    }

    /**
     * @return list<int>
     */
    private function bitsOf(int $value, int $length): array
    {
        $bits = [];

        for ($i = $length - 1; $i >= 0; $i--) {
            $bits[] = ($value >> $i) & 1;
        }

        return $bits;
    }
}
