<?php
/* QPV al Volante — tráfico en vivo (los datos los mide el robot cada 20 min). */
if (!defined('ABSPATH')) exit;
$s = qpv_kv_get('qpv-trafico', 'instantanea');
$avisos = qpv_notas(8, ['category_name' => 'transito', 'date_query' => [['after' => '3 days ago']]]);
$color = ['fluido' => '#1E9E5A', 'lento' => '#E0A100', 'pesado' => '#D7262E'];
$nivel = ['fluido' => 'Fluido', 'lento' => 'Lento', 'pesado' => 'Pesado'];
$hora = !empty($s['actualizado']) ? qpv_hora($s['actualizado']) : null;
add_filter('document_title_parts', fn() => ['title' => 'QPV al Volante — Tráfico en Puerto Vallarta en vivo']);
add_action('wp_head', fn() => print('<meta name="description" content="Cómo está el puente del Ameca, la Medina Ascencio y la carretera 200 en este momento: tiempos de traslado, accidentes, cierres y obras en Puerto Vallarta y Bahía de Banderas.">'));
get_header();
?>
<div class="container section">
  <div class="breadcrumbs"><a href="<?= esc_url(home_url('/')) ?>">Inicio</a> / QPV al Volante</div>
  <span class="card-kicker">QPV al Volante</span>
  <h1 style="margin:4px 0 6px">Así está el tráfico en Vallarta ahora</h1>
  <?php qpv_presentado_por('trafico'); ?>
  <p style="color:var(--text-muted);max-width:680px;margin-bottom:22px"><?= $hora ? "Actualizado a las $hora h. Se revisa cada 20 minutos." : 'El monitor de tráfico se está activando; en unos minutos verás aquí los tiempos de cada vialidad.' ?></p>
  <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:24px">
    <section aria-label="Mapa de tráfico en vivo">
      <iframe src="https://embed.waze.com/es/iframe?zoom=12&lat=20.655&lon=-105.24" title="Mapa de tráfico en vivo de Waze" style="width:100%;height:460px;border:0;border-radius:12px" allowfullscreen loading="lazy"></iframe>
      <p style="font-size:12px;color:var(--text-muted);margin-top:6px">Mapa en vivo: Waze</p>
    </section>
    <section aria-label="Corredores e incidentes">
      <h2 style="font-size:20px;margin:0 0 8px">Vialidades principales</h2>
      <?php if (empty($s['corredores'])): ?><p style="color:var(--text-muted)">Sin mediciones por ahora.</p><?php endif; ?>
      <?php foreach (($s['corredores'] ?? []) as $c): $col = $color[$c['nivel']] ?? '#888'; ?>
        <div style="display:flex;align-items:center;gap:12px;padding:10px 0;border-bottom:1px solid var(--border, rgba(127,127,127,.25))">
          <span aria-hidden="true" style="width:12px;height:12px;border-radius:6px;background:<?= $col ?>;flex:none"></span>
          <span style="flex:1"><?= qpv_e($c['nombre']) ?></span>
          <strong><?= (int) $c['minutos'] ?> min</strong>
          <span style="color:<?= $col ?>;font-weight:700;min-width:60px;text-align:right"><?= $c['retrasoMin'] > 0 ? '+' . (int) $c['retrasoMin'] : qpv_e($nivel[$c['nivel']] ?? '') ?></span>
        </div>
      <?php endforeach; ?>

      <h2 style="font-size:20px;margin:24px 0 8px">Avisos de tránsito</h2>
      <?php if (!$avisos): ?><p style="color:var(--text-muted)">Sin avisos en los últimos días.</p><?php endif; ?>
      <?php foreach ($avisos as $a): ?>
        <div style="display:flex;gap:12px;padding:8px 0;border-bottom:1px solid var(--border, rgba(127,127,127,.25))"><span style="color:var(--text-muted);min-width:92px;font-size:14px"><?= qpv_e(qpv_fecha_corta($a['publishedAt']) . ' · ' . qpv_hora($a['publishedAt'])) ?></span><a href="<?= esc_url($a['url']) ?>"><?= qpv_e($a['title']) ?></a></div>
      <?php endforeach; ?>

      <h2 style="font-size:20px;margin:24px 0 8px">Incidentes detectados</h2>
      <?php $inc = $s['resumen'] ?? []; if (!$inc): ?><p style="color:var(--text-muted)">No hay incidentes reportados.</p><?php endif; ?>
      <?php foreach (array_slice($inc, 0, 12) as $r): $rojo = in_array($r['tipo'] ?? '', ['accidente', 'cierre', 'inundacion'], true); ?>
        <div style="padding:8px 0;border-bottom:1px solid var(--border, rgba(127,127,127,.25))">
          <strong<?= $rojo ? ' style="color:#D7262E"' : '' ?>><?= qpv_e($r['t']) ?></strong>
          <div style="font-size:14px;color:var(--text-muted)"><?= qpv_e($r['d']) ?></div>
        </div>
      <?php endforeach; ?>
      <p style="font-size:12px;color:var(--text-muted);margin-top:12px">Tiempos e incidentes detectados: TomTom Traffic, pueden tener unos minutos de retraso. Avisos: Tránsito, Protección Civil y redacción QPV. Emergencias: 911.</p>
    </section>
  </div>
</div>
<?php get_footer();
