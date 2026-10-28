<?php
/* Respaldo de WordPress: listas (archivo, etiquetas) con tarjetas del sitio. */
if (!defined('ABSPATH')) exit;
get_header();
?>
<div class="container section">
  <h1 style="margin:0 0 16px"><?= qpv_e(wp_strip_all_tags(get_the_archive_title() ?: 'Noticias')) ?></h1>
  <?php if (have_posts()): ?>
    <div class="grid grid-3"><?php while (have_posts()) { the_post(); qpv_card(qpv_nota(get_post())); } ?></div>
    <div style="margin-top:24px"><?php the_posts_pagination(); ?></div>
  <?php else: ?>
    <div class="empty-state"><h3>No hay notas aquí</h3></div>
  <?php endif; ?>
</div>
<?php get_footer();
