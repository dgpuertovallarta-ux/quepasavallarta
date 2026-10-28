<?php
/* Nota (equivale a src/app/noticia/[slug]/page.tsx). También sirve a Vallarta Explica. */
if (!defined('ABSPATH')) exit;
the_post();
$n = qpv_nota(get_post());
$esExplica = $n['tipo'] === 'explica';
$sponsor = $n['sponsor'];
$emergencia = (bool) preg_match('/protecci[oó]n civil|hurac[aá]n|tormenta|alerta|evacua|refugio|inundaci|sismo/iu', $n['title'] . ' ' . $n['dek']);
$rel = $esExplica ? qpv_explicadores(6) : qpv_notas_categoria($n['category'], 6);
$rel = array_slice(array_values(array_filter($rel, fn($r) => $r['slug'] !== $n['slug'])), 0, 4);
$imgSocial = $n['imageUrl'] ?: qpv_asset('brand/logo.png');

add_action('wp_head', function () use ($n, $imgSocial) {
    $d = esc_attr($n['dek']);
    echo '<meta name="description" content="' . $d . '">' . "\n";
    echo '<link rel="canonical" href="' . esc_url($n['url']) . '">' . "\n";
    foreach (['og:type' => 'article', 'og:title' => $n['title'], 'og:description' => $n['dek'], 'og:url' => $n['url'], 'og:site_name' => 'Qué Pasa Vallarta', 'og:locale' => 'es_MX', 'og:image' => $imgSocial, 'article:published_time' => $n['publishedAt']] as $k => $v) {
        echo '<meta property="' . $k . '" content="' . esc_attr($v) . '">' . "\n";
    }
    echo '<meta name="twitter:card" content="summary_large_image"><meta name="twitter:image" content="' . esc_attr($imgSocial) . '">' . "\n";
    $ld = [
        '@context' => 'https://schema.org', '@type' => 'NewsArticle', 'headline' => $n['title'], 'description' => $n['dek'],
        'image' => [$imgSocial], 'datePublished' => $n['publishedAt'], 'dateModified' => $n['updatedAt'],
        'articleSection' => qpv_categoria_nombre($n['category']), 'inLanguage' => 'es-MX', 'mainEntityOfPage' => $n['url'],
        'author' => ['@type' => 'Organization', 'name' => 'Qué Pasa Vallarta', 'url' => home_url('/')],
        'publisher' => ['@type' => 'Organization', 'name' => 'Qué Pasa Vallarta', 'logo' => ['@type' => 'ImageObject', 'url' => qpv_asset('brand/logo-transparent.png')]],
    ];
    echo '<script type="application/ld+json">' . wp_json_encode($ld, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_HEX_TAG) . '</script>' . "\n";
}, 5);

get_header();
?>
<div class="container section article-page">
  <div class="breadcrumbs">
    <a href="<?= esc_url(home_url('/')) ?>">Inicio</a> /
    <?php if ($esExplica): ?><a href="<?= esc_url(home_url('/explica/')) ?>">Vallarta Explica</a>
    <?php else: ?><a href="<?= esc_url(home_url('/categoria/' . $n['category'] . '/')) ?>"><?= qpv_e(qpv_categoria_nombre($n['category'])) ?></a><?php endif; ?>
  </div>
  <div class="article-head">
    <?php if ($n['breaking']): ?><span class="chip chip-breaking">Última hora</span>
    <?php else: ?><span class="chip"><?= qpv_e($esExplica ? 'Vallarta Explica' : qpv_categoria_nombre($n['category'])) ?></span><?php endif; ?>
    <?php if (!$esExplica): ?>
      <?php if ($n['verified']): ?><span class="chip chip-verified" style="margin-left:6px">Verificado</span>
      <?php else: ?><span class="chip chip-demo" style="margin-left:6px">Sin confirmación oficial</span><?php endif; ?>
    <?php endif; ?>
    <?php if ($sponsor): ?><span class="chip chip-sponsor" style="margin-left:6px">Patrocinado</span><?php endif; ?>
    <h1><?= qpv_e($n['title']) ?></h1>
    <?php if ($sponsor): ?><p class="sponsor-note">Contenido patrocinado por <?= qpv_e($sponsor) ?>.</p><?php endif; ?>
    <p class="article-dek"><?= qpv_e($n['dek']) ?></p>
    <?php qpv_byline($n); ?>
    <?php qpv_escuchar($n); ?>
  </div>

  <?php if ($n['imageUrl']): ?>
  <figure class="article-figure"><div class="card-media">
    <img src="<?= esc_url($n['imageUrl']) ?>" alt="<?= esc_attr($n['title']) ?>" class="qpv-fill" fetchpriority="high">
    <span class="photo-tag"><?= qpv_e('Foto: ' . ($n['imageCredit'] ?: 'fuente original')) ?></span>
  </div></figure>
  <?php endif; ?>

  <article class="prose"><?php the_content(); ?></article>

  <?php if (!$emergencia && !$sponsor && !$esExplica) qpv_ad_slot('article'); ?>

  <?php if (!$esExplica || $n['sources']): ?>
  <div class="panel" style="max-width:780px;margin-top:24px">
    <strong style="font-size:13px">Fuentes</strong>
    <ul style="margin:8px 0 0;padding-left:18px;font-size:13.5px;color:var(--text-muted)">
      <?php foreach ($n['sources'] as $s): ?><li><a href="<?= esc_url($s['url'] ?? '#') ?>"><?= qpv_e($s['label'] ?? $s['url'] ?? '') ?></a></li><?php endforeach; ?>
    </ul>
    <p style="font-size:12px;color:var(--text-muted);margin:10px 0 0">Última actualización: <?= qpv_e(qpv_fecha_hora($n['updatedAt'])) ?> · Redactado con asistencia de IA a partir de las fuentes citadas y revisado por el equipo editorial antes de publicarse.</p>
  </div>
  <?php endif; ?>

  <div class="section" style="padding-bottom:0;max-width:900px">
    <?php qpv_section_head($esExplica ? 'Más de Vallarta Explica' : 'Relacionadas'); ?>
    <div class="panel">
      <?php if ($rel): foreach ($rel as $r) qpv_list_item($r);
      else: ?><p style="color:var(--text-muted)">Todavía no hay más notas de esta categoría.</p><?php endif; ?>
    </div>
  </div>
</div>
<?php get_footer();
