<?php
/** Datos fijos del sitio (exportados de src/lib/*.ts a data/*.json): agenda, fotos, zonas, planes. */
if (!defined('ABSPATH')) exit;

function qpv_json(string $n): array
{
    static $cache = [];
    if (!isset($cache[$n])) {
        $f = get_template_directory() . "/data/$n.json";
        $cache[$n] = is_file($f) ? (json_decode((string) file_get_contents($f), true) ?: []) : [];
    }
    return $cache[$n];
}

function qpv_foto(string $clave): string { return qpv_json('fotos')['fotos'][$clave] ?? ''; }
function qpv_foto_credito(string $clave): string
{
    $c = qpv_json('fotos')['creditos'][$clave] ?? '';
    return $c ? "Foto ilustrativa: $c" : 'Foto ilustrativa';
}

function qpv_eventos(): array { return qpv_json('eventos'); }

function qpv_eventos_proximos(): array
{
    $hoy = wp_date('Y-m-d', null, new DateTimeZone(QPV_TZ));
    $ev = array_values(array_filter(qpv_eventos(), fn($e) => ($e['endDate'] ?? $e['date']) >= $hoy));
    $k = fn($e) => $e['date'] >= $hoy ? $e['date'] : ((!empty($e['endDate']) && !empty($e['recurrence'])) ? "$hoy~" : $hoy);
    usort($ev, fn($a, $b) => strcmp($k($a), $k($b)) ?: strcmp($a['date'], $b['date']));
    return $ev;
}

function qpv_dia_corto(string $iso, bool $anio = false): string
{
    $t = strtotime($iso . 'T12:00:00Z');
    $m = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sept', 'oct', 'nov', 'dic'][(int) gmdate('n', $t) - 1];
    return gmdate('j', $t) . " $m" . ($anio ? ' ' . gmdate('Y', $t) : '');
}

function qpv_evento_fecha(array $e): string
{
    if (empty($e['endDate'])) return qpv_dia_corto($e['date']);
    $cruza = substr($e['endDate'], 0, 4) !== substr($e['date'], 0, 4);
    $r = qpv_dia_corto($e['date']) . ' – ' . qpv_dia_corto($e['endDate'], $cruza);
    return !empty($e['recurrence']) ? $e['recurrence'] . " · $r" : $r;
}

function qpv_evento(string $slug): ?array
{
    foreach (qpv_eventos() as $e) if ($e['slug'] === $slug) return $e;
    return null;
}

/** Reels de la página de Facebook (los actualiza el robot en la opción qpv_reels). */
function qpv_reels(): array
{
    $r = get_option('qpv_reels', []);
    return is_array($r) ? array_slice($r, 0, 20) : [];
}
