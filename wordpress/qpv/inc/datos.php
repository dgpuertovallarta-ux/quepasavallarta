<?php
/**
 * Datos del sitio: categorías, campos de cada nota, "Vallarta Explica" y
 * las consultas que usaba el sitio original (portada, sección, emergencias).
 */
if (!defined('ABSPATH')) exit;

const QPV_SITE = [
    'name' => 'Qué Pasa Vallarta',
    'tagline' => 'Información clara y confiable de Puerto Vallarta.',
    'salesWhatsapp' => '523223951186',
    'salesWhatsappLabel' => '322 395 1186',
];

const QPV_CATEGORIAS = [
    'ultima-hora' => 'Última Hora', 'seguridad' => 'Seguridad', 'gobierno' => 'Gobierno', 'comunidad' => 'Comunidad',
    'turismo' => 'Turismo', 'economia' => 'Economía', 'negocios' => 'Negocios', 'transito' => 'Tránsito',
    'playas' => 'Playas', 'clima' => 'Clima', 'cultura' => 'Cultura', 'gastronomia' => 'Gastronomía',
    'eventos' => 'Eventos', 'entretenimiento' => 'Entretenimiento', 'deportes' => 'Deportes',
    'medio-ambiente' => 'Medio Ambiente', 'servicios' => 'Servicios', 'politica' => 'Política',
    'jalisco' => 'Jalisco', 'mexico' => 'México', 'mundo' => 'Mundo',
];

const QPV_TONO = [
    'ultima-hora' => 'rojo', 'seguridad' => 'rojo', 'proteccion-civil' => 'rojo',
    'gobierno' => 'navy', 'politica' => 'navy', 'jalisco' => 'navy', 'mexico' => 'navy', 'mundo' => 'navy',
    'transito' => 'ambar', 'servicios' => 'ambar',
    'clima' => 'teal', 'medio-ambiente' => 'teal', 'playas' => 'teal', 'turismo' => 'teal',
];

/* Campos de cada nota (se pueden leer y escribir por la API REST). */
const QPV_META = [
    'qpv_image_url' => 'string',     // foto propia de la nota (URL)
    'qpv_image_credit' => 'string',  // crédito de la foto
    'qpv_breaking' => 'boolean',     // Última hora
    'qpv_verified' => 'boolean',     // confirmado con fuente oficial
    'qpv_author' => 'string',        // redaccion | ia
    'qpv_sources' => 'string',       // JSON [{label,url}]
    'qpv_score' => 'integer',        // relevancia 0–100
    'qpv_zone' => 'string',          // zona de Mi Vallarta
    'qpv_patrocinado' => 'string',   // nombre del patrocinador (nota patrocinada)
    'qpv_story_key' => 'string',     // clave del hecho (evita duplicados del robot)
    'qpv_original_slug' => 'string', // slug en el sitio anterior
    'qpv_audio_url' => 'string',     // MP3 de la nota (voz)
];

add_action('init', function () {
    foreach (['post', 'explica'] as $tipo) {
        foreach (QPV_META as $k => $t) {
            register_post_meta($tipo, $k, [
                'type' => $t,
                'single' => true,
                'show_in_rest' => true,
                'auth_callback' => fn() => current_user_can('edit_posts'),
            ]);
        }
    }
});

/* Vallarta Explica: tipo de contenido aparte, con URL /explica/{slug}. */
add_action('init', function () {
    register_post_type('explica', [
        'label' => 'Vallarta Explica',
        'labels' => ['name' => 'Vallarta Explica', 'singular_name' => 'Explicador', 'add_new_item' => 'Nuevo explicador'],
        'public' => true,
        'has_archive' => false,
        'rewrite' => ['slug' => 'explica', 'with_front' => false],
        'show_in_rest' => true,
        'menu_icon' => 'dashicons-lightbulb',
        'supports' => ['title', 'editor', 'excerpt', 'custom-fields', 'thumbnail'],
        'taxonomies' => ['category'],
    ]);
});

function qpv_crear_categorias(): void
{
    foreach (QPV_CATEGORIAS as $slug => $nombre) {
        if ($slug === 'ultima-hora') continue; // no se archiva nada ahí: es "lo más reciente"
        if (!term_exists($slug, 'category')) wp_insert_term($nombre, 'category', ['slug' => $slug]);
    }
    // "Sin categoría" de WordPress pasa a ser Comunidad.
    $sin = get_term_by('slug', 'uncategorized', 'category') ?: get_term_by('slug', 'sin-categoria', 'category');
    $com = get_term_by('slug', 'comunidad', 'category');
    if ($com) update_option('default_category', $com->term_id);
    if ($sin && $com && $sin->term_id !== $com->term_id && $sin->count === 0) wp_delete_term($sin->term_id, 'category');
}

/* Páginas fijas: cada una usa su plantilla (templates/*.php). */
const QPV_PAGINAS = [
    'ahora' => 'Vallarta Ahora', 'trafico' => 'QPV al Volante', 'reporte' => 'Reporte Ciudadano',
    'proteccion-civil' => 'Protección Civil', 'alertas' => 'Alertas', 'explica' => 'Vallarta Explica',
    'agenda' => 'Vive Vallarta', 'guia' => 'Vallarta Guía', 'mi-vallarta' => 'Mi Vallarta',
    'pregunta' => 'Pregúntale a Vallarta', 'conecta' => 'Vallarta Conecta', 'privacidad' => 'Aviso de privacidad',
    'buscar' => 'Buscar',
];

function qpv_crear_paginas(): void
{
    foreach (QPV_PAGINAS as $slug => $titulo) {
        if (get_page_by_path($slug)) continue;
        wp_insert_post(['post_type' => 'page', 'post_status' => 'publish', 'post_name' => $slug, 'post_title' => $titulo, 'post_content' => '']);
    }
}

/* /denuncia (anterior) → /reporte */
add_action('template_redirect', function () {
    $p = trim(parse_url($_SERVER['REQUEST_URI'] ?? '', PHP_URL_PATH) ?: '', '/');
    if ($p === 'denuncia') { wp_redirect(home_url('/reporte/'), 301); exit; }
});

/* La página "explica" no debe chocar con el tipo de contenido explica. */
add_filter('page_template_hierarchy', function ($t) {
    $p = get_queried_object();
    if ($p instanceof WP_Post && isset(QPV_PAGINAS[$p->post_name])) {
        array_unshift($t, 'templates/' . $p->post_name . '.php');
    }
    return $t;
});

/* ---------- Una nota como la usaba el sitio original ---------- */

function qpv_categoria_nombre(string $slug): string
{
    return QPV_CATEGORIAS[$slug] ?? ($slug === 'proteccion-civil' ? 'Protección Civil' : ucfirst($slug));
}

function qpv_nota($post): array
{
    $post = get_post($post);
    $cats = get_the_category($post->ID);
    $cat = $cats ? $cats[0]->slug : 'comunidad';
    $m = fn($k) => get_post_meta($post->ID, $k, true);
    $fuentes = json_decode((string) $m('qpv_sources'), true);
    $img = (string) $m('qpv_image_url');
    if (!$img && has_post_thumbnail($post)) $img = (string) get_the_post_thumbnail_url($post, 'large');
    return [
        'id' => $post->ID,
        'tipo' => $post->post_type,
        'slug' => $post->post_name,
        'url' => get_permalink($post),
        'title' => html_entity_decode(get_the_title($post), ENT_QUOTES, 'UTF-8'),
        'dek' => html_entity_decode(wp_strip_all_tags($post->post_excerpt ?: wp_trim_words($post->post_content, 40, '…')), ENT_QUOTES, 'UTF-8'),
        'category' => $cat,
        'author' => $m('qpv_author') ?: 'redaccion',
        'breaking' => (bool) $m('qpv_breaking'),
        'verified' => (bool) $m('qpv_verified'),
        'publishedAt' => get_post_time('c', true, $post),
        'updatedAt' => get_post_modified_time('c', true, $post),
        'imageUrl' => $img,
        'imageCredit' => (string) $m('qpv_image_credit'),
        'sources' => is_array($fuentes) ? $fuentes : [],
        'sponsor' => (string) $m('qpv_patrocinado'),
    ];
}

/** Notas publicadas, más nuevas primero. */
function qpv_notas(int $n = 20, array $extra = []): array
{
    $q = new WP_Query(array_merge([
        'post_type' => 'post', 'post_status' => 'publish', 'posts_per_page' => $n,
        'orderby' => 'date', 'order' => 'DESC', 'ignore_sticky_posts' => true, 'no_found_rows' => true,
    ], $extra));
    return array_map('qpv_nota', $q->posts);
}

function qpv_notas_categoria(string $slug, int $n = 36): array
{
    if ($slug === 'ultima-hora') return qpv_notas($n);
    return qpv_notas($n, ['category_name' => $slug]);
}

function qpv_explicadores(int $n = 10): array
{
    $q = new WP_Query(['post_type' => 'explica', 'post_status' => 'publish', 'posts_per_page' => $n, 'no_found_rows' => true]);
    return array_map('qpv_nota', $q->posts);
}

/** Categorías que ya tienen notas (para no enlazar secciones vacías). */
function qpv_categorias_activas(): array
{
    $t = get_terms(['taxonomy' => 'category', 'hide_empty' => true, 'fields' => 'slugs']);
    return is_array($t) ? $t : [];
}

const QPV_TERMINOS_EMERGENCIA = [
    'proteccion civil', 'huracan', 'tormenta tropical', 'ciclon', 'evacu', 'refugio', 'albergue', 'inundaci',
    'desbord', 'deslave', 'marejada', 'oleaje', 'suspenden clases', 'suspension de clases', 'suspenden actividades',
    'alerta', 'bomberos', 'zona de riesgo', 'zonas de riesgo', 'damnificad', 'lluvias intensas', 'rafagas', 'sismo',
];

function qpv_sin_acentos(string $s): string
{
    return strtr(mb_strtolower($s, 'UTF-8'), ['á' => 'a', 'é' => 'e', 'í' => 'i', 'ó' => 'o', 'ú' => 'u', 'ü' => 'u', 'ñ' => 'n']);
}

/** Notas de Protección Civil / emergencias de los últimos días. */
function qpv_emergencias(int $limite = 30, int $dias = 7): array
{
    $notas = qpv_notas(200, ['date_query' => [['after' => "$dias days ago"]]]);
    $out = [];
    foreach ($notas as $n) {
        $t = qpv_sin_acentos($n['title'] . ' ' . $n['dek']);
        foreach (QPV_TERMINOS_EMERGENCIA as $w) {
            if (str_contains($t, $w)) { $out[] = $n; break; }
        }
        if (count($out) >= $limite) break;
    }
    return $out;
}

/* ---------- Quitar notas casi iguales de las portadas ---------- */

const QPV_STOP = ['de', 'la', 'el', 'en', 'y', 'a', 'que', 'del', 'los', 'las', 'un', 'una', 'con', 'por', 'para', 'se', 'su', 'es', 'al',
    'puerto', 'vallarta', 'bahia', 'banderas', 'vigilan', 'region'];

function qpv_tokens(string $t): array
{
    $w = preg_split('/[^a-z0-9]+/', qpv_sin_acentos($t)) ?: [];
    $out = [];
    foreach ($w as $x) {
        if (strlen($x) <= 2 || in_array($x, QPV_STOP, true)) continue;
        if (strlen($x) > 4 && str_ends_with($x, 's')) $x = substr($x, 0, -1);
        $out[$x] = true;
    }
    return $out;
}

function qpv_similitud(array $a, array $b): float
{
    if (!$a || !$b) return 0;
    $i = count(array_intersect_key($a, $b));
    return $i / min(count($a), count($b));
}

function qpv_sin_duplicados(array $items, float $umbral = 0.4): array
{
    $tok = array_map(fn($n) => qpv_tokens($n['title']), $items);
    $freq = [];
    foreach ($tok as $s) foreach ($s as $w => $_) $freq[$w] = ($freq[$w] ?? 0) + 1;
    $comun = max(3, (int) ceil(count($items) * 0.2));
    $kept = [];
    foreach ($items as $i => $n) {
        $dup = false;
        foreach ($kept as $k) {
            if (abs(strtotime($items[$k]['publishedAt']) - strtotime($n['publishedAt'])) >= 36 * 3600) continue;
            if (qpv_similitud($tok[$k], $tok[$i]) < $umbral) continue;
            $comp = 0;
            foreach ($tok[$k] as $w => $_) if (isset($tok[$i][$w]) && ($freq[$w] ?? 0) < $comun) $comp++;
            if ($comp >= 3) { $dup = true; break; }
        }
        if (!$dup) $kept[] = $i;
    }
    return array_values(array_map(fn($k) => $items[$k], $kept));
}

/* ---------- Fechas ---------- */

function qpv_hace(string $iso): string
{
    $min = (int) round((time() - strtotime($iso)) / 60);
    if ($min < 1) return 'justo ahora';
    if ($min < 60) return "hace $min min";
    $h = (int) round($min / 60);
    if ($h < 24) return "hace $h h";
    return 'hace ' . (int) round($h / 24) . ' d';
}

/** Fecha en español sin depender del idioma instalado en WordPress. Formato: j, d, n, Y, H, i, F (mes), M (mes corto), l (día). */
function qpv_fecha(string $iso, string $formato): string
{
    $d = new DateTime($iso);
    $d->setTimezone(new DateTimeZone(QPV_TZ));
    return qpv_formato_es($d, $formato);
}

function qpv_formato_es(DateTimeInterface $d, string $formato): string
{
    $meses = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
    $cortos = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sept', 'oct', 'nov', 'dic'];
    $dias = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
    $out = '';
    $esc = false;
    foreach (preg_split('//u', $formato, -1, PREG_SPLIT_NO_EMPTY) as $c) {
        if ($esc) { $out .= $c; $esc = false; continue; }
        if ($c === '\\') { $esc = true; continue; }
        $out .= match ($c) {
            'F' => $meses[(int) $d->format('n') - 1],
            'M' => $cortos[(int) $d->format('n') - 1],
            'l' => $dias[(int) $d->format('w')],
            'j', 'd', 'n', 'Y', 'H', 'i', 'G' => $d->format($c),
            default => $c,
        };
    }
    return $out;
}

/** Ahora en Vallarta con formato en español. */
function qpv_hoy(string $formato): string
{
    return qpv_formato_es(new DateTime('now', new DateTimeZone(QPV_TZ)), $formato);
}

function qpv_hora(string $iso): string { return qpv_fecha($iso, 'H:i'); }
function qpv_fecha_corta(string $iso): string { return qpv_fecha($iso, 'j M'); }
function qpv_fecha_larga(string $iso): string { return qpv_fecha($iso, 'j \d\e F \d\e Y'); }
function qpv_fecha_hora(string $iso): string { return qpv_fecha($iso, 'j M') . ' · ' . qpv_fecha($iso, 'H:i'); }
