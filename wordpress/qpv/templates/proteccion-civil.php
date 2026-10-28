<?php
/* Protección Civil: aviso oficial del NHC + notas de emergencia. */
if (!defined('ABSPATH')) exit;
$avisos = qpv_avisos_nhc();
$items = qpv_sin_duplicados(qpv_emergencias(30, 7));
$links = [['Centro Nacional de Huracanes (avisos oficiales)', 'https://www.nhc.noaa.gov/?epac'], ['Servicio Meteorológico Nacional — Conagua', 'https://smn.conagua.gob.mx/'], ['Protección Civil y Bomberos Jalisco', 'https://proteccioncivil.jalisco.gob.mx/']];
get_header();
?>
<div class="container section">
  <div class="breadcrumbs"><a href="<?= esc_url(home_url('/')) ?>">Inicio</a> / Protección Civil</div>
  <h1 style="margin:0 0 6px">Protección Civil</h1>
  <p style="color:var(--text-muted);max-width:680px;margin-bottom:22px">Avisos oficiales de ciclones para la costa de Jalisco y lo que publican las autoridades y los medios sobre alertas, refugios, suspensiones y servicios en Puerto Vallarta y la bahía.</p>
  <div class="pc-grid">
    <section class="pc-official" aria-label="Avisos oficiales vigentes">
      <span class="card-kicker">Aviso oficial vigente</span>
      <?php if ($avisos): foreach ($avisos as $a): ?>
        <div class="pc-advisory">
          <h2><?= qpv_e($a['system']) ?></h2>
          <?php if ($a['headline']): ?><p class="pc-advisory-lead"><?= qpv_e($a['headline']) ?>.</p><?php endif; ?>
          <p class="pc-advisory-meta"><?= qpv_e($a['label'] . ($a['publishedAt'] ? ' · emitido ' . qpv_hace($a['publishedAt']) : '')) ?> · Centro Nacional de Huracanes</p>
          <a href="<?= esc_url($a['url']) ?>" target="_blank" rel="noopener noreferrer" class="btn btn-outline btn-sm">Leer el aviso oficial completo</a>
        </div>
      <?php endforeach; else: ?>
        <p class="pc-advisory-meta" style="margin-top:10px">En este momento no hay un aviso de ciclón vigente para la costa de Jalisco o Nayarit.</p>
      <?php endif; ?>
    </section>
    <aside class="pc-side">
      <div class="pc-emergency"><span>Emergencias</span><a href="tel:911">911</a></div>
      <span class="card-kicker">Fuentes oficiales</span>
      <ul class="pc-links">
        <?php foreach ($links as [$n, $u]): ?><li><a href="<?= esc_url($u) ?>" target="_blank" rel="noopener noreferrer"><?= qpv_e($n) ?></a></li><?php endforeach; ?>
        <li><a href="<?= esc_url(home_url('/ahora/')) ?>">Clima, oleaje y viento en este momento</a></li>
      </ul>
    </aside>
  </div>
  <h2 class="pc-section-title">Lo más reciente</h2>
  <?php if ($items): ?><div class="grid grid-3"><?php foreach ($items as $n) qpv_card($n); ?></div>
  <?php else: ?><div class="empty-state"><h3>Sin avisos de Protección Civil en los últimos días</h3><p>Cuando haya alertas, suspensiones o avisos de las autoridades aparecerán aquí. Mientras tanto, revisa <a href="<?= esc_url(home_url('/categoria/ultima-hora/')) ?>">lo más reciente</a>.</p></div><?php endif; ?>
</div>
<?php get_footer();
