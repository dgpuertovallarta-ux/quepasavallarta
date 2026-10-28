<?php
/* Explicador (equivale a src/app/explica/[slug]/page.tsx). El contenido trae los bloques "Qué pasó", "Por qué importa"… */
if (!defined('ABSPATH')) exit;
the_post();
$e = qpv_nota(get_post());
get_header();
?>
<div class="container section">
  <div class="breadcrumbs"><a href="<?= esc_url(home_url('/')) ?>">Inicio</a> / <a href="<?= esc_url(home_url('/explica/')) ?>">Vallarta Explica</a></div>
  <div class="article-head">
    <span class="chip">Vallarta Explica</span>
    <h1><?= qpv_e($e['title']) ?></h1>
    <p class="article-dek"><?= qpv_e($e['dek']) ?></p>
    <p style="font-size:13px;color:var(--text-muted)"><?= qpv_e(qpv_fecha_larga($e['publishedAt'])) ?></p>
  </div>
  <?php if ($e['imageUrl']): ?>
    <div class="card-media" style="max-width:780px;aspect-ratio:16/9;border-radius:var(--radius-md);margin-bottom:22px"><img src="<?= esc_url($e['imageUrl']) ?>" alt="<?= esc_attr($e['title']) ?>" class="qpv-fill"><span class="photo-tag"><?= qpv_e('Foto: ' . ($e['imageCredit'] ?: 'fuente original')) ?></span></div>
  <?php endif; ?>
  <div class="panel" style="max-width:780px"><?php the_content(); ?></div>
  <div class="panel" style="max-width:780px;margin-top:16px">
    <strong style="font-size:13px">Fuentes</strong>
    <ul style="margin:8px 0 0;padding-left:18px;font-size:13.5px;color:var(--text-muted)">
      <?php foreach ($e['sources'] as $s): ?><li><a href="<?= esc_url($s['url'] ?? '#') ?>"><?= qpv_e($s['label'] ?? '') ?></a></li><?php endforeach; ?>
    </ul>
    <p style="font-size:12px;color:var(--text-muted);margin:10px 0 0">Redactado con asistencia de IA a partir de las fuentes citadas y revisado por el equipo editorial antes de publicarse.</p>
  </div>
</div>
<?php get_footer();
