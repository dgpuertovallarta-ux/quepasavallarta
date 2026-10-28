<?php
/* Vallarta Explica (índice). */
if (!defined('ABSPATH')) exit;
$items = qpv_explicadores(20);
get_header();
?>
<div class="container section">
  <div class="breadcrumbs"><a href="<?= esc_url(home_url('/')) ?>">Inicio</a> / Vallarta Explica</div>
  <h1 style="margin:0 0 6px">Vallarta Explica</h1>
  <p style="color:var(--text-muted);max-width:640px;margin-bottom:20px">Para temas complejos: qué pasó, por qué importa, qué sabemos, qué no sabemos y qué sigue.</p>
  <?php if (!$items): ?><div class="empty-state">Muy pronto, los primeros explicadores.</div><?php endif; ?>
  <div class="grid grid-2">
    <?php foreach ($items as $e): ?>
      <a href="<?= esc_url($e['url']) ?>" class="card" style="text-decoration:none;color:inherit">
        <div class="card-media"><?php qpv_visual($e, ['alt' => $e['title'], 'credito' => false, 'seccion' => 'Vallarta Explica']); ?><span class="chip" style="position:absolute;top:10px;left:10px;z-index:2">Explica</span></div>
        <div class="card-body"><span class="card-kicker"><?= qpv_e(qpv_fecha_larga($e['publishedAt'])) ?></span><h2 class="card-title" style="margin:4px 0"><?= qpv_e($e['title']) ?></h2><p class="card-dek"><?= qpv_e($e['dek']) ?></p></div>
      </a>
    <?php endforeach; ?>
  </div>
</div>
<?php get_footer();
