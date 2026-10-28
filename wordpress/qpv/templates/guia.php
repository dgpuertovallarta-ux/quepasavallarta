<?php
/* Vallarta Guía. */
if (!defined('ABSPATH')) exit;
get_header();
?>
<div class="container section">
  <div class="breadcrumbs"><a href="<?= esc_url(home_url('/')) ?>">Inicio</a> / Vallarta Guía</div>
  <h1 style="margin:0 0 6px">Vallarta Guía</h1>
  <p style="color:var(--text-muted);max-width:660px;margin-bottom:18px">Directorio de restaurantes, hoteles, tours, salud, inmobiliarias y más. Los negocios marcados como “Destacado” tienen un plan Vallarta Conecta. <a href="<?= esc_url(home_url('/conecta/')) ?>">Anuncia tu negocio aquí</a>.</p>
  <div class="empty-state"><h3>Muy pronto: los negocios de Vallarta</h3><p>Estamos dando de alta los primeros negocios de la guía. ¿Quieres que el tuyo aparezca aquí, con fotos, WhatsApp y mapa? <a href="<?= esc_url(home_url('/conecta/')) ?>">Anúnciate con nosotros</a>.</p></div>
</div>
<?php get_footer();
