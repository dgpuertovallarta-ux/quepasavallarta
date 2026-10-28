<?php
/* Alertas: lo de mayor impacto. */
if (!defined('ABSPATH')) exit;
$recent = qpv_sin_duplicados(qpv_notas(60));
$urg = array_slice(array_values(array_filter($recent, fn($n) => (int) get_post_meta($n['id'], 'qpv_score', true) >= 80)), 0, 15);
$items = $urg ?: array_slice($recent, 0, 10);
get_header();
?>
<div class="container section">
  <div class="breadcrumbs"><a href="<?= esc_url(home_url('/')) ?>">Inicio</a> / Alertas</div>
  <h1 style="margin:0 0 6px">Alertas</h1>
  <p style="color:var(--text-muted);max-width:640px;margin-bottom:20px">Lo más importante que está pasando en Puerto Vallarta y la bahía: avisos, emergencias y noticias de mayor impacto, de lo más reciente a lo más antiguo.</p>
  <?php if ($items): ?><div class="panel"><?php foreach ($items as $n) qpv_list_item($n); ?></div>
  <?php else: ?><div class="empty-state">No hay alertas por ahora.</div><?php endif; ?>
</div>
<?php get_footer();
