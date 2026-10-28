<?php
/* Vive Vallarta — Agenda (índice y /agenda/{slug}). */
if (!defined('ABSPATH')) exit;
$slug = get_query_var('qpv_item');
if ($slug) {
    $e = qpv_evento($slug);
    if (!$e) { status_header(404); get_template_part('404'); return; }
    add_filter('document_title_parts', fn() => ['title' => $e['title'], 'site' => 'Qué Pasa Vallarta']);
    get_header(); ?>
    <div class="container section article-page">
      <div class="breadcrumbs"><a href="<?= esc_url(home_url('/')) ?>">Inicio</a> / <a href="<?= esc_url(home_url('/agenda/')) ?>">Vive Vallarta</a></div>
      <div class="article-head"><span class="chip"><?= qpv_e($e['category']) ?></span><h1><?= qpv_e($e['title']) ?></h1><p class="article-dek"><?= qpv_e($e['dek']) ?></p></div>
      <figure class="article-figure"><div class="card-media"><img src="<?= esc_url(qpv_foto($e['image'])) ?>" alt="" class="qpv-fill"><span class="photo-tag"><?= qpv_e(qpv_foto_credito($e['image'])) ?></span></div></figure>
      <dl class="fact-list">
        <div><dt>Cuándo</dt><dd><?= qpv_e(qpv_evento_fecha($e)) ?></dd></div>
        <div><dt>Dónde</dt><dd><?= qpv_e($e['location']) ?></dd></div>
        <div><dt>Más información</dt><dd><a href="<?= esc_url($e['sourceUrl']) ?>" target="_blank" rel="noopener noreferrer"><?= qpv_e($e['sourceName']) ?> (calendario oficial de turismo)</a></dd></div>
      </dl>
      <p style="font-size:13px;color:var(--text-muted);max-width:720px;margin-top:16px">Las fechas y horarios pueden cambiar. Confirma con el organizador antes de ir.</p>
    </div>
    <?php get_footer(); return;
}
$up = qpv_eventos_proximos();
$cats = array_merge(['Todas'], array_values(array_unique(array_column($up, 'category'))));
$cat = in_array($_GET['cat'] ?? '', $cats, true) ? $_GET['cat'] : 'Todas';
$items = array_filter($up, fn($e) => $cat === 'Todas' || $e['category'] === $cat);
get_header();
?>
<div class="container section">
  <div class="breadcrumbs"><a href="<?= esc_url(home_url('/')) ?>">Inicio</a> / Vive Vallarta</div>
  <h1 style="margin:0 0 6px">Vive Vallarta — Agenda</h1>
  <p style="color:var(--text-muted);max-width:640px;margin-bottom:18px">Conciertos, festivales, deportes y tradiciones en Puerto Vallarta y la bahía. Las fechas vienen del calendario oficial de turismo; confirma horarios con el organizador antes de ir.</p>
  <div class="filter-row">
    <?php foreach ($cats as $c): ?><a href="<?= esc_url($c === 'Todas' ? home_url('/agenda/') : add_query_arg('cat', $c, home_url('/agenda/'))) ?>" class="filter-chip<?= $c === $cat ? ' active' : '' ?>" style="text-decoration:none"><?= qpv_e($c) ?></a><?php endforeach; ?>
  </div>
  <?php if ($items): ?>
    <div class="grid grid-3">
      <?php foreach ($items as $e): ?>
        <article class="card">
          <div class="card-media"><img src="<?= esc_url(qpv_foto($e['image'])) ?>" alt="<?= esc_attr($e['title']) ?>" loading="lazy" class="qpv-fill"><span class="photo-tag"><?= qpv_e(qpv_foto_credito($e['image'])) ?></span></div>
          <div class="card-body"><span class="card-kicker"><?= qpv_e($e['category'] . ' · ' . qpv_evento_fecha($e)) ?></span><h3 class="card-title"><a href="<?= esc_url(home_url('/agenda/' . $e['slug'] . '/')) ?>"><?= qpv_e($e['title']) ?></a></h3><p class="card-dek"><?= qpv_e($e['dek']) ?></p><div class="card-meta"><?= qpv_e($e['location']) ?></div></div>
        </article>
      <?php endforeach; ?>
    </div>
  <?php else: ?><div class="empty-state">Por ahora no hay eventos próximos en la agenda.</div><?php endif; ?>
</div>
<?php get_footer();
