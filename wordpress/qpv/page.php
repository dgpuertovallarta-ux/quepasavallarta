<?php
/* Página genérica (las secciones fijas usan templates/{slug}.php). */
if (!defined('ABSPATH')) exit;
get_header(); the_post();
?>
<div class="container section">
  <div class="breadcrumbs"><a href="<?= esc_url(home_url('/')) ?>">Inicio</a> / <?php the_title(); ?></div>
  <h1 style="margin:0 0 16px"><?php the_title(); ?></h1>
  <article class="prose"><?php the_content(); ?></article>
</div>
<?php get_footer();
