<?php
/* Vallarta Conecta (publicidad). */
if (!defined('ABSPATH')) exit;
$wa = 'https://wa.me/' . QPV_SITE['salesWhatsapp'] . '?text=' . rawurlencode('Hola, me interesa anunciarme en Qué Pasa Vallarta');
get_header();
?>
<div class="container section">
  <div class="breadcrumbs"><a href="<?= esc_url(home_url('/')) ?>">Inicio</a> / Vallarta Conecta</div>
  <div class="article-head">
    <span class="chip chip-sponsor">Para negocios</span>
    <h1>Vallarta Conecta</h1>
    <p class="article-dek">Visibilidad, audiencia y leads reales en Puerto Vallarta. No vendemos “un banner”: vendemos resultados medibles.</p>
    <a class="btn btn-primary" href="<?= esc_url($wa) ?>" target="_blank" rel="noopener" style="margin-top:6px">Escríbenos por WhatsApp · <?= qpv_e(QPV_SITE['salesWhatsappLabel']) ?></a>
  </div>
  <div class="grid grid-4" style="margin-bottom:30px">
    <?php foreach (qpv_json('planes') as $p): ?>
      <div class="panel"><h3 style="margin:0 0 8px;font-size:16px"><?= qpv_e($p['name']) ?></h3><p style="font-size:13.5px;color:var(--text-muted);margin:0 0 12px"><?= qpv_e($p['desc']) ?></p><span class="chip chip-sponsor">Cotiza sin compromiso</span></div>
    <?php endforeach; ?>
  </div>
  <div class="panel" style="max-width:720px">
    <h3 style="margin-top:0">¿Qué incluye un perfil Vallarta Conecta?</h3>
    <ul style="font-size:14.5px;color:var(--text);line-height:1.8">
      <li>Ficha con logo, fotos, ubicación en mapa, horarios y descripción</li>
      <li>Botón directo de WhatsApp y llamada</li>
      <li>Aparición en Vallarta Guía y, en planes superiores, en Home / Agenda</li>
      <li>Estadísticas de impresiones, clics y contactos generados</li>
      <li>Posibilidad de contenido patrocinado (“Vallarta Presenta”) y patrocinio de sección</li>
    </ul>
  </div>
  <div class="panel" style="max-width:720px;margin-top:16px">
    <h3 style="margin-top:0">¿Te interesa? Escríbenos</h3>
    <p style="font-size:13.5px;color:var(--text-muted)">Déjanos tus datos y te contactamos con las opciones para tu negocio, o escríbenos directo por <a href="<?= esc_url($wa) ?>" target="_blank" rel="noopener">WhatsApp al <?= qpv_e(QPV_SITE['salesWhatsappLabel']) ?></a>.</p>
    <form style="display:flex;flex-wrap:wrap;gap:10px;margin-top:10px" data-qpv-lead action="<?= esc_url(rest_url('qpv/v1/lead')) ?>">
      <input name="business" class="search-input-lg" style="max-width:240px" placeholder="Nombre del negocio" required minlength="2" maxlength="160">
      <input name="contact" class="search-input-lg" style="max-width:240px" placeholder="WhatsApp o correo" required minlength="6" maxlength="160">
      <textarea name="message" class="search-input-lg" style="flex-basis:100%;min-height:70px" placeholder="¿Qué te interesa? (opcional)" maxlength="2000"></textarea>
      <input name="website" tabindex="-1" autocomplete="off" aria-hidden="true" style="position:absolute;left:-9999px;width:1px;height:1px">
      <button class="btn btn-primary" type="submit">Solicitar información</button>
    </form>
  </div>
</div>
<?php get_footer();
