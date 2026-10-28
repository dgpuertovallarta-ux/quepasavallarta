<?php
/* Vallarta Ahora. */
if (!defined('ABSPATH')) exit;
$items = qpv_notas(30);
usort($items, fn($a, $b) => strtotime($b['updatedAt']) <=> strtotime($a['updatedAt']));
$cats = array_values(array_unique(array_column($items, 'category')));
get_header();
?>
<div class="container section">
  <div class="breadcrumbs"><a href="<?= esc_url(home_url('/')) ?>">Inicio</a> / Vallarta Ahora</div>
  <h1 style="margin:0 0 6px">Vallarta Ahora</h1>
  <p style="color:var(--text-muted);max-width:640px;margin-bottom:20px">El estado de la ciudad en este momento: clima, oleaje y calidad del aire con datos en vivo, y las noticias conforme se van actualizando.</p>
  <div class="ahora-strip surface-dark" data-qpv-ahora>
    <div class="ahora-strip-head"><div class="ahora-strip-title"><span class="live-dot"></span> VALLARTA AHORA <span class="chip chip-verified">En vivo</span></div></div>
    <div class="ahora-grid">
      <div class="ahora-tile"><span class="ahora-tile-label">☀️ Clima ahora</span><span class="ahora-tile-value" data-clima>Cargando…</span><span class="ahora-tile-sub">Open-Meteo</span></div>
      <div class="ahora-tile"><span class="ahora-tile-label">🏖️ Oleaje / Playas</span><span class="ahora-tile-value" data-oleaje>Cargando…</span><span class="ahora-tile-sub">Open-Meteo Marine</span></div>
      <div class="ahora-tile"><span class="ahora-tile-label">🌬️ Calidad del aire</span><span class="ahora-tile-value" data-aire>Cargando…</span><span class="ahora-tile-sub">Open-Meteo</span></div>
    </div>
  </div>
  <div class="section" style="padding-bottom:0">
    <?php qpv_section_head('Última actualización de noticias', ['sub' => 'Ordenado por más reciente']); ?>
    <div class="panel" data-qpv-tabs>
      <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:12px">
        <button type="button" class="filter-chip active" data-cat="todas">Todas</button>
        <?php foreach ($cats as $c): ?><button type="button" class="filter-chip" data-cat="<?= esc_attr($c) ?>"><?= qpv_e(qpv_categoria_nombre($c)) ?></button><?php endforeach; ?>
      </div>
      <div>
        <?php foreach ($items as $n): ?>
          <div class="latest-list-item" data-c="<?= esc_attr($n['category']) ?>"><span class="latest-list-time"><?= qpv_e(qpv_hora($n['updatedAt'])) ?></span><a href="<?= esc_url($n['url']) ?>"><?= qpv_e($n['title']) ?></a></div>
        <?php endforeach; ?>
      </div>
    </div>
  </div>
</div>
<?php get_footer();
