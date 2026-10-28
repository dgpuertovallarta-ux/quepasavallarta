<?php
/* Pregúntale a Vallarta: búsqueda sobre lo publicado (no inventa respuestas). */
if (!defined('ABSPATH')) exit;
$q = mb_substr(trim(sanitize_text_field(wp_unslash($_GET['q'] ?? ''))), 0, 200);
$res = $q ? array_slice(qpv_sin_duplicados(qpv_notas(12, ['s' => $q])), 0, 8) : [];
$lista = $q && !$res ? qpv_notas(5) : $res;
$sug = ['Huracán', 'Tráfico', 'Aeropuerto', 'Seguridad', 'Playas', 'Agua'];
get_header();
?>
<div class="container section article-page">
  <div class="breadcrumbs"><a href="<?= esc_url(home_url('/')) ?>">Inicio</a> / Pregúntale a Vallarta</div>
  <div class="ask-box">
    <h1 style="margin:0 0 8px">Pregúntale a Vallarta</h1>
    <p style="max-width:640px;margin:0;color:var(--text-muted)">Escribe un tema o una pregunta y te mostramos lo que hemos publicado al respecto, con su fuente. Solo responde con información que está en el sitio.</p>
    <form class="ask-input-row" action="<?= esc_url(home_url('/pregunta/')) ?>" method="get">
      <input class="ask-input" name="q" value="<?= esc_attr($q) ?>" placeholder="Por ejemplo: ¿sigue abierto el aeropuerto?" aria-label="Tu pregunta">
      <button class="btn btn-primary" type="submit">Preguntar</button>
    </form>
    <div class="ask-suggestions"><?php foreach ($sug as $s): ?><a class="ask-suggestion" href="<?= esc_url(add_query_arg('q', $s, home_url('/pregunta/'))) ?>"><?= qpv_e($s) ?></a><?php endforeach; ?></div>
  </div>
  <?php if ($q): ?>
  <div class="ask-answer">
    <?php if (!$res): ?><div class="ask-fact"><div class="ask-fact-label">Sin resultados</div><p>No encontramos notas sobre “<?= qpv_e($q) ?>”. Prueba con otras palabras; mientras tanto, esto es lo más reciente:</p></div><?php endif; ?>
    <?php foreach ($lista as $n): ?>
      <div class="ask-fact">
        <div class="ask-fact-label"><?= qpv_e(qpv_categoria_nombre($n['category']) . ' · ' . qpv_hace($n['updatedAt'])) ?></div>
        <p><a href="<?= esc_url($n['url']) ?>"><strong><?= qpv_e($n['title']) ?></strong></a><?php if ($n['dek']): ?><br><?= qpv_e($n['dek']) ?><?php endif; ?></p>
        <?php if (!empty($n['sources'][0]['label'])): ?><p style="font-size:12px;color:var(--text-muted)">Fuente: <?= qpv_e($n['sources'][0]['label']) ?></p><?php endif; ?>
      </div>
    <?php endforeach; ?>
  </div>
  <?php endif; ?>
</div>
<?php get_footer();
