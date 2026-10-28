<?php
/* Sección (equivale a src/app/categoria/[slug]/page.tsx). También /categoria/ultima-hora. */
if (!defined('ABSPATH')) exit;
$slug = get_query_var('qpv_seccion') === 'ultima-hora' ? 'ultima-hora' : (get_queried_object()->slug ?? 'ultima-hora');
$nombre = qpv_categoria_nombre($slug);
$items = qpv_sin_duplicados(qpv_notas_categoria($slug, 36));
$activas = qpv_categorias_activas();
$chips = array_filter(QPV_CATEGORIAS, fn($n, $s) => $s === 'ultima-hora' || $s === $slug || !$activas || in_array($s, $activas, true), ARRAY_FILTER_USE_BOTH);
add_filter('document_title_parts', fn($p) => ['title' => $nombre, 'site' => 'Qué Pasa Vallarta']);
status_header(200);
get_header();
?>
<div class="container section">
  <div class="breadcrumbs"><a href="<?= esc_url(home_url('/')) ?>">Inicio</a> / <?= qpv_e($nombre) ?></div>
  <h1 style="margin:0 0 16px"><?= qpv_e($nombre) ?></h1>
  <?php if ($slug === 'clima') qpv_presentado_por('clima'); ?>
  <div class="filter-row">
    <?php foreach ($chips as $s => $n): ?>
      <a href="<?= esc_url(home_url("/categoria/$s/")) ?>" class="filter-chip<?= $s === $slug ? ' active' : '' ?>" style="text-decoration:none;display:inline-block"><?= qpv_e($n) ?></a>
    <?php endforeach; ?>
  </div>
  <?php if ($slug !== 'clima' && $slug !== 'seguridad') qpv_ad_slot('section'); ?>
  <?php if ($items): ?>
    <div class="grid grid-3"><?php foreach ($items as $n) qpv_card($n); ?></div>
  <?php else: ?>
    <div class="empty-state"><h3>Todavía no hay notas en <?= qpv_e($nombre) ?></h3><p>Cuando publiquemos algo en esta sección aparecerá aquí. Mientras tanto, revisa <a href="<?= esc_url(home_url('/categoria/ultima-hora/')) ?>">lo más reciente</a>.</p></div>
  <?php endif; ?>
</div>
<?php get_footer();
