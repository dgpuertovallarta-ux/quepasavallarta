<?php
/**
 * Piezas reutilizables (equivalen a src/components/cards.tsx y NewsVisual.tsx).
 * Todas imprimen HTML con las mismas clases del sitio original.
 */
if (!defined('ABSPATH')) exit;

function qpv_e($s): string { return esc_html((string) $s); }
function qpv_asset(string $rel): string { return get_template_directory_uri() . '/assets/' . ltrim($rel, '/'); }

/* /categoria/ultima-hora no es una categoría de WordPress: es "lo más reciente". */
add_action('init', function () {
    add_rewrite_rule('^categoria/ultima-hora/?$', 'index.php?qpv_seccion=ultima-hora', 'top');
});
add_filter('query_vars', function ($v) { $v[] = 'qpv_seccion'; return $v; });
add_filter('template_include', function ($t) {
    if (get_query_var('qpv_seccion') === 'ultima-hora') return get_template_directory() . '/category.php';
    return $t;
});

/** Foto de la nota, o pleca de color con la sección cuando no tiene foto propia. */
function qpv_visual(array $n, array $o = []): void
{
    $credito = $o['credito'] ?? true;
    if (!empty($n['imageUrl'])) {
        $alt = $o['alt'] ?? '';
        $lazy = empty($o['priority']) ? ' loading="lazy"' : ' fetchpriority="high"';
        echo '<img src="' . esc_url($n['imageUrl']) . '" alt="' . esc_attr($alt) . '"' . $lazy . ' decoding="async" class="qpv-fill">';
        if ($credito) echo '<span class="photo-tag">Foto: ' . qpv_e($n['imageCredit'] ?: 'fuente original') . '</span>';
        return;
    }
    qpv_pleca($n['category'] ?? null, $o);
}

function qpv_pleca(?string $cat, array $o = []): void
{
    $tono = ($cat && isset(QPV_TONO[$cat])) ? QPV_TONO[$cat] : 'azul';
    if (!empty($o['fondo'])) { echo '<div class="qpv-tile qpv-tile-' . $tono . ' qpv-tile-fondo" aria-hidden="true"></div>'; return; }
    $etiqueta = $o['seccion'] ?? ($cat ? qpv_categoria_nombre($cat) : 'Qué Pasa Vallarta');
    $peq = !empty($o['pequena']);
    echo '<div class="qpv-tile qpv-tile-' . $tono . ($peq ? ' qpv-tile-sm' : '') . '" aria-hidden="true">';
    if (!$peq) echo '<span class="qpv-tile-seccion">' . qpv_e($etiqueta) . '</span>';
    echo '<img class="qpv-tile-logo" src="' . esc_url(qpv_asset($tono === 'ambar' ? 'qpv-logo-azul.png' : 'qpv-logo-blanco.png')) . '" alt="">';
    echo '</div>';
}

function qpv_meta(array $n): void
{
    echo '<div class="card-meta">';
    if (!empty($n['breaking'])) echo '<span class="chip chip-breaking">Última hora</span>';
    echo '<span>' . qpv_e(qpv_hace($n['updatedAt'] ?: $n['publishedAt'])) . '</span>';
    echo '</div>';
}

function qpv_card(array $n, array $o = []): void
{
    $compact = !empty($o['compact']);
    $square = !empty($o['square']);
    ?>
    <article class="card">
      <div class="card-media<?= $square ? ' square' : '' ?>"><?php qpv_visual($n, ['alt' => $n['title'], 'priority' => !empty($o['priority'])]); ?></div>
      <div class="card-body">
        <span class="card-kicker"><?= qpv_e(qpv_categoria_nombre($n['category'])) ?></span>
        <h3 class="card-title"><a href="<?= esc_url($n['url']) ?>"><?= qpv_e($n['title']) ?></a></h3>
        <?php if (!$compact): ?><p class="card-dek"><?= qpv_e($n['dek']) ?></p><?php endif; ?>
        <?php qpv_meta($n); ?>
      </div>
    </article>
    <?php
}

function qpv_list_item(array $n): void
{
    ?>
    <div class="card-list-item">
      <div class="card-list-thumb" style="position:relative;overflow:hidden"><?php qpv_visual($n, ['credito' => false, 'pequena' => true]); ?></div>
      <div class="card-list-body">
        <span class="card-kicker"><?= qpv_e(qpv_categoria_nombre($n['category'])) ?></span>
        <h4 class="card-title"><a href="<?= esc_url($n['url']) ?>"><?= qpv_e($n['title']) ?></a></h4>
        <?php qpv_meta($n); ?>
      </div>
    </div>
    <?php
}

function qpv_section_head(string $titulo, array $o = []): void
{
    echo '<div class="section-head"><div><div class="section-title">' . ($o['titulo_html'] ?? qpv_e($titulo)) . '</div>';
    if (!empty($o['sub'])) echo '<div class="section-sub">' . qpv_e($o['sub']) . '</div>';
    echo '</div>';
    if (!empty($o['href'])) {
        $label = preg_replace('/\s*→\s*$/u', '', $o['label'] ?? 'Ver todo');
        $ext = str_starts_with($o['href'], 'http') ? ' target="_blank" rel="noopener"' : '';
        echo '<a class="section-link" href="' . esc_url($o['href']) . '"' . $ext . '>' . qpv_e($label) . '<span class="arrow-line" aria-hidden="true"></span></a>';
    }
    echo '</div>';
}

function qpv_byline(array $n): void
{
    $autores = ['redaccion' => ['Redacción Qué Pasa Vallarta', 'QPV'], 'ia' => ['Asistido por IA · revisado por Redacción', 'IA']];
    [$nombre, $ini] = $autores[$n['author']] ?? $autores['redaccion'];
    echo '<div class="byline"><span class="avatar">' . qpv_e($ini) . '</span><span><strong style="color:var(--text)">' . qpv_e($nombre) . '</strong> · ' . qpv_e(qpv_fecha_larga($n['publishedAt'])) . '</span></div>';
}

/** Icono SVG del sitio. */
function qpv_icono(string $n): string
{
    $i = [
        'buscar' => '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5"/><path d="m15.5 15.5 5 5"/></svg>',
        'menu' => '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M3 6h18M3 12h18M3 18h18"/></svg>',
        'cerrar' => '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="m5 5 14 14M19 5 5 19"/></svg>',
        'chevron' => '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>',
    ];
    return $i[$n] ?? '';
}

/** "Presentado por" (patrocinio de sección). */
function qpv_presentado_por(string $seccion): void
{
    $p = function_exists('qpv_patrocinio') ? qpv_patrocinio($seccion) : null;
    if (!$p) return;
    $img = $p['logo'] ? '<img src="' . esc_url($p['logo']) . '" alt="' . esc_attr($p['nombre']) . '" loading="lazy">' : '<strong>' . qpv_e($p['nombre']) . '</strong>';
    echo '<a class="presentado-por" href="' . esc_url($p['clic']) . '" target="_blank" rel="sponsored noopener" aria-label="Presentado por ' . esc_attr($p['nombre']) . '"><span>Presentado por</span>' . $img . '</a>';
}

/** Franja de clima de la portada (los datos los pone qpv.js desde Open-Meteo). */
function qpv_weather_bar(): void
{
    $hoy = qpv_hoy('l, j \d\e F');
    $hoy = mb_strtoupper(mb_substr($hoy, 0, 1)) . mb_substr($hoy, 1);
    ?>
    <a href="<?= esc_url(home_url('/ahora/')) ?>" class="weather-bar" aria-label="Clima en Puerto Vallarta — ver Vallarta Ahora" data-qpv-clima>
      <div class="weather-bar-place"><strong><?= qpv_e($hoy) ?></strong><span>Puerto Vallarta, Jalisco</span></div>
      <div class="weather-bar-temp" data-t>—</div>
      <div class="weather-bar-detail"><strong data-desc>Clima ahora</strong><span data-ola>Oleaje —</span></div>
      <div class="weather-bar-air">
        <div class="weather-bar-air-label"><strong>Calidad del aire</strong><span>Índice US AQI</span></div>
        <div class="weather-bar-aqi" data-aqi><b>—</b></div>
      </div>
    </a>
    <?php
}

function qpv_newsletter_form(): void
{
    ?>
    <form class="newsletter-form" method="post" action="<?= esc_url(rest_url('qpv/v1/boletin')) ?>" data-qpv-newsletter>
      <input type="email" name="email" required placeholder="Ingresa tu correo" aria-label="Correo electrónico">
      <input type="text" name="sitio_web" tabindex="-1" autocomplete="off" style="position:absolute;left:-9999px" aria-hidden="true">
      <button class="newsletter-submit" type="submit" aria-label="Suscribirme"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m9 5 7 7-7 7"/></svg></button>
    </form>
    <?php
}

/** "Escuchar nota": voz del dispositivo (Web Speech) o el MP3 de la nota si existe (meta qpv_audio_url). */
function qpv_escuchar(array $n): void
{
    $texto = wp_strip_all_tags(get_post_field('post_content', $n['id']));
    $min = max(1, (int) round(str_word_count($n['title'] . ' ' . $n['dek'] . ' ' . $texto) / 160));
    $mp3 = (string) get_post_meta($n['id'], 'qpv_audio_url', true);
    ?>
    <div class="escuchar-nota" role="group" aria-label="Escuchar la nota" hidden data-qpv-escuchar data-mp3="<?= esc_attr($mp3) ?>">
      <button type="button" class="escuchar-boton" aria-pressed="false"><span aria-hidden="true" class="escuchar-icono">▶</span><span data-l>Escuchar nota</span><span class="escuchar-min">· <?= $min ?> min</span></button>
      <button type="button" class="escuchar-detener" hidden>Detener</button>
      <template data-texto><?= esc_html($n['title'] . '. ' . $n['dek'] . ' ' . $texto) ?></template>
    </div>
    <?php
}

/* /agenda/{slug} y /mi-vallarta/{zona} usan la plantilla de su página. */
add_action('init', function () {
    add_rewrite_rule('^agenda/([^/]+)/?$', 'index.php?pagename=agenda&qpv_item=$matches[1]', 'top');
    add_rewrite_rule('^mi-vallarta/([^/]+)/?$', 'index.php?pagename=mi-vallarta&qpv_item=$matches[1]', 'top');
});
add_filter('query_vars', function ($v) { $v[] = 'qpv_item'; return $v; });

/** Avisos públicos vigentes del NHC que mencionan la costa de Jalisco o Nayarit (caché 10 min). */
function qpv_avisos_nhc(): array
{
    $c = get_transient('qpv_nhc');
    if (is_array($c)) return $c;
    $out = [];
    $r = wp_remote_get('https://www.nhc.noaa.gov/index-ep-sp.xml', ['timeout' => 6]);
    if (!is_wp_error($r) && wp_remote_retrieve_response_code($r) === 200) {
        $xml = @simplexml_load_string(wp_remote_retrieve_body($r));
        if ($xml && isset($xml->channel->item)) {
            foreach ($xml->channel->item as $it) {
                $titulo = trim(str_replace('*', '', (string) $it->title));
                $desc = wp_strip_all_tags((string) $it->description);
                if (!preg_match('/aviso p[uú]blico/iu', $titulo)) continue;
                if (!preg_match('/cabo corrientes|puerto vallarta|vallarta|jalisco|nayarit|punta mita|san blas|islas mar[ií]as|playa p[eé]rula|manzanillo/iu', "$titulo $desc")) continue;
                preg_match('/^(.*?)\s+Aviso P[uú]blico\s+N[uú]mero\s+(\S+)/iu', $titulo, $m);
                $sistema = $m ? trim($m[1]) : $titulo;
                $lead = preg_match('/\.\.\.([^.]{12,220})\.\.\./u', $desc, $l) ? $l[1] : null;
                if ($lead) {
                    $lead = mb_strtolower(preg_replace('/\s+/', ' ', trim($lead)));
                    foreach (['méxico' => 'México', 'mexico' => 'México', 'jalisco' => 'Jalisco', 'nayarit' => 'Nayarit', 'colima' => 'Colima', 'manzanillo' => 'Manzanillo', 'cabo corrientes' => 'Cabo Corrientes', 'puerto vallarta' => 'Puerto Vallarta', 'baja california' => 'Baja California', 'pacífico' => 'Pacífico'] as $a => $b) $lead = preg_replace('/\b' . preg_quote($a, '/') . '\b/u', $b, $lead);
                    $nombre = explode(' ', $sistema);
                    $nombre = end($nombre);
                    if ($nombre) $lead = preg_replace('/\b' . preg_quote(mb_strtolower($nombre), '/') . '\b/u', $nombre, $lead);
                    $lead = mb_strtoupper(mb_substr($lead, 0, 1)) . mb_substr($lead, 1);
                }
                $out[] = ['system' => $sistema, 'label' => $m ? 'Aviso público núm. ' . $m[2] : 'Aviso público', 'headline' => $lead,
                    'publishedAt' => (string) $it->pubDate ? gmdate('c', strtotime((string) $it->pubDate)) : null, 'url' => (string) $it->link ?: 'https://www.nhc.noaa.gov/?epac'];
            }
        }
    }
    set_transient('qpv_nhc', $out, 10 * MINUTE_IN_SECONDS);
    return $out;
}
