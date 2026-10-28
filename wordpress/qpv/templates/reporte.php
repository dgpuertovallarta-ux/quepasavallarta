<?php
/* Reporte Ciudadano: formulario con foto + reportes publicados. */
if (!defined('ABSPATH')) exit;
$reportes = qpv_notas(8, ['meta_key' => 'qpv_es_reporte']);
if (!$reportes) $reportes = qpv_notas(8, ['s' => 'Reporte ciudadano', 'sentence' => true]);
get_header();
?>
<div class="container section">
  <div class="breadcrumbs"><a href="<?= esc_url(home_url('/')) ?>">Inicio</a> / Reporte Ciudadano</div>
  <span class="chip chip-breaking">Reporte ciudadano</span>
  <h1 style="margin:8px 0 6px">¿Viste algo en tu colonia? Repórtalo</h1>
  <?php qpv_presentado_por('reportes'); ?>
  <p style="color:var(--text-muted);max-width:680px;margin-bottom:20px">Baches, basura, fugas, falta de luz, tráfico, inseguridad o abusos en la vía pública. Mándanos tu reporte con foto: nuestro equipo lo revisa y lo publicamos en el sitio y en Facebook para que llegue a las autoridades.</p>
  <div class="reporte-pasos">
    <div><b>1</b>Toma una foto y escribe dónde y qué pasa.</div>
    <div><b>2</b>Nuestro equipo lo revisa (tus datos nunca se publican).</div>
    <div><b>3</b>Sale en quepasavta.com y en nuestro Facebook.</div>
  </div>
  <div class="denuncia-grid">
    <div data-qpv-reporte-box>
    <form class="denuncia-form" data-qpv-reporte action="<?= esc_url(rest_url('qpv/v1/reporte')) ?>" enctype="multipart/form-data">
      <label for="d-tipo">¿Qué quieres reportar? *</label>
      <select id="d-tipo" name="tipo" required>
        <option value="" disabled selected>Escoge una opción</option>
        <?php foreach (QPV_TIPOS_REPORTE as $k => $v): ?><option value="<?= esc_attr($k) ?>"><?= qpv_e($v) ?></option><?php endforeach; ?>
      </select>
      <label for="d-lugar">¿Dónde pasa? *</label>
      <input id="d-lugar" name="lugar" required maxlength="140" placeholder="Ej. Entrada a la autopista en Bucerías, frente a…">
      <button type="button" class="btn denuncia-ubic" data-ubic>📍 Usar mi ubicación</button>
      <p class="denuncia-nota" data-ubic-msg hidden></p>
      <input type="hidden" name="lat"><input type="hidden" name="lon">
      <label for="d-titulo">Resúmelo en una frase</label>
      <input id="d-titulo" name="titulo" maxlength="110" placeholder="Ej. Usan el acotamiento para brincarse la fila">
      <label for="d-texto">Cuéntanos qué pasa *</label>
      <textarea id="d-texto" name="texto" required minlength="40" maxlength="3000" rows="6" placeholder="Qué ves, desde cuándo, a qué hora pasa y a quién afecta."></textarea>
      <label for="d-foto">Foto *</label>
      <input id="d-foto" name="foto" type="file" accept="image/jpeg,image/png,image/webp" required>
      <img alt="Vista previa de tu foto" class="denuncia-vista" hidden data-vista>
      <p class="denuncia-nota">Sin caras de menores ni datos personales visibles. Máximo 8 MB.</p>
      <div class="denuncia-fila">
        <div><label for="d-nombre">Tu nombre (no se publica)</label><input id="d-nombre" name="nombre" maxlength="80"></div>
        <div><label for="d-contacto">WhatsApp o correo (no se publica)</label><input id="d-contacto" name="contacto" maxlength="140"></div>
      </div>
      <input name="web" tabindex="-1" autocomplete="off" aria-hidden="true" class="denuncia-trampa">
      <p class="denuncia-error" role="alert" hidden data-err></p>
      <button type="submit" class="btn btn-primary">Enviar reporte</button>
      <p class="denuncia-nota">Todos los reportes pasan por revisión antes de publicarse. Publicamos tu testimonio y tu foto, nunca tu nombre, tu contacto ni tu ubicación exacta.</p>
    </form>
    </div>
    <aside>
      <h2 style="font-size:20px;margin:0 0 12px">Reportes recientes</h2>
      <?php if (!$reportes): ?><p style="color:var(--text-muted)">Todavía no hay reportes publicados. El tuyo puede ser el primero.</p><?php endif; ?>
      <div class="grid" style="gap:20px"><?php foreach ($reportes as $n) qpv_card($n, ['compact' => true]); ?></div>
    </aside>
  </div>
</div>
<?php get_footer();
