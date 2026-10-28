<?php
/* Buscar (equivale a src/app/buscar/page.tsx). */
if (!defined('ABSPATH')) exit;
$q = trim(sanitize_text_field(wp_unslash($_GET['q'] ?? '')));
$ql = mb_strtolower($q);
$news = $q ? qpv_sin_duplicados(qpv_notas(24, ['s' => $q, 'post_type' => ['post', 'explica']])) : [];
$events = $q ? array_values(array_filter(qpv_eventos_proximos(), fn($e) => str_contains(mb_strtolower($e['title'] . $e['dek'] . $e['location']), $ql))) : [];
add_action('wp_head', fn() => print('<meta name="robots" content="noindex,follow">'));
get_header();
?>
<div class="container section">
  <div class="breadcrumbs"><a href="<?= esc_url(home_url('/')) ?>">Inicio</a> / Buscar</div>
  <h1 style="margin:0 0 16px">Buscar</h1>
  <form style="margin-bottom:22px" action="<?= esc_url(home_url('/buscar/')) ?>" method="get">
    <input class="search-input-lg" name="q" placeholder="Buscar noticias, eventos, negocios…" value="<?= esc_attr($q) ?>">
  </form>
  <?php if (!$q): ?>
    <div class="empty-state">Escribe algo para buscar en noticias, agenda y directorio.</div>
  <?php elseif (!$news && !$events): ?>
    <div class="empty-state">No encontramos nada con “<?= qpv_e($q) ?>”. Prueba con otras palabras.</div>
  <?php else: ?>
    <?php if ($news): ?>
      <h3>Noticias</h3>
      <div class="panel" style="margin-bottom:20px">
        <?php foreach ($news as $n): ?>
          <div class="card-list-item"><div class="card-list-body"><h4 class="card-title"><a href="<?= esc_url($n['url']) ?>"><?= qpv_e($n['title']) ?></a></h4><div class="card-meta"><?= qpv_e(qpv_hace($n['publishedAt'])) ?></div></div></div>
        <?php endforeach; ?>
      </div>
    <?php endif; ?>
    <?php if ($events): ?>
      <h3>Agenda</h3>
      <div class="panel" style="margin-bottom:20px">
        <?php foreach ($events as $e): ?>
          <div class="card-list-item"><div class="card-list-body"><h4 class="card-title"><a href="<?= esc_url(home_url('/agenda/' . $e['slug'] . '/')) ?>"><?= qpv_e($e['title']) ?></a></h4><div class="card-meta"><?= qpv_e(qpv_evento_fecha($e) . ' · ' . $e['location']) ?></div></div></div>
        <?php endforeach; ?>
      </div>
    <?php endif; ?>
  <?php endif; ?>
</div>
<?php get_footer();
