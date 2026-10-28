<?php
/* Mi Vallarta (y /mi-vallarta/{zona}). */
if (!defined('ABSPATH')) exit;
$zonas = qpv_json('zonas');
$zona = get_query_var('qpv_item');
$nombreZona = '';
foreach ($zonas as $z) if ($z['slug'] === $zona) $nombreZona = $z['name'];
$items = $nombreZona ? qpv_notas(12, ['s' => '"' . $nombreZona . '"', 'sentence' => true]) : [];
get_header();
?>
<div class="container section">
  <div class="breadcrumbs"><a href="<?= esc_url(home_url('/')) ?>">Inicio</a> / Mi Vallarta</div>
  <h1 style="margin:0 0 6px">Mi Vallarta</h1>
  <p style="color:var(--text-muted);max-width:640px;margin-bottom:20px">Elige tu zona para ver noticias, tránsito, seguridad y eventos hiperlocales.</p>
  <div class="zone-grid">
    <?php foreach ($zonas as $z): ?><a href="<?= esc_url(home_url('/mi-vallarta/' . $z['slug'] . '/')) ?>" class="zone-btn<?= $z['slug'] === $zona ? ' active' : '' ?>" style="text-decoration:none"><?= qpv_e($z['name']) ?><small>Noticias, tránsito y eventos de tu colonia</small></a><?php endforeach; ?>
  </div>
  <?php if ($nombreZona): ?>
  <div class="section" style="padding-bottom:0">
    <?php qpv_section_head($nombreZona); ?>
    <?php if ($items): ?><div class="grid grid-3"><?php foreach ($items as $n) qpv_card($n); ?></div>
    <?php else: ?><div class="empty-state">Todavía no hay notas recientes que mencionen esta zona. Cuando publiquemos alguna, aparecerá aquí.</div><?php endif; ?>
  </div>
  <?php endif; ?>
</div>
<?php get_footer();
