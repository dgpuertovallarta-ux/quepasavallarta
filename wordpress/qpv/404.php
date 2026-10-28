<?php
if (!defined('ABSPATH')) exit;
get_header();
?>
<div class="container section">
  <div class="empty-state">
    <h3>No encontramos esta página</h3>
    <p>Puede que la nota se haya movido. Revisa <a href="<?= esc_url(home_url('/categoria/ultima-hora/')) ?>">lo más reciente</a> o <a href="<?= esc_url(home_url('/buscar/')) ?>">busca</a>.</p>
  </div>
</div>
<?php get_footer();
