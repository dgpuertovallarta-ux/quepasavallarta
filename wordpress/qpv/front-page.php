<?php
/* Portada (equivale a src/app/page.tsx). */
if (!defined('ABSPATH')) exit;
get_header();

$emergencia = qpv_emergencias(6, 2);
$alerta = count($emergencia) >= 3 ? $emergencia[0] : null;
$todas = qpv_sin_duplicados(qpv_notas(45));
$lead = $todas[0] ?? null;
$leadMore = array_slice($todas, 1, 2);
$trio = array_slice($todas, 3, 3);
$feature = $todas[6] ?? null;
$timeline = array_slice($todas, 7, 6);
$rest = array_slice($todas, 13, 12);
$more = count($rest) > 4 ? array_slice($rest, 0, intdiv(count($rest), 4) * 4) : $rest;
$explica = qpv_sin_duplicados(qpv_explicadores(10));
$eventos = array_slice(qpv_eventos_proximos(), 0, 8);
$reels = qpv_reels();
$fbReels = 'https://www.facebook.com/quepasavallarta/reels';
?>
<div class="container">
  <?php if ($alerta): ?>
    <a href="<?= esc_url(home_url('/proteccion-civil/')) ?>" class="alert-band"><strong>Protección Civil</strong><span><?= qpv_e($alerta['title']) ?></span><em>Avisos oficiales y cobertura →</em></a>
  <?php endif; ?>
  <?php qpv_weather_bar(); ?>
</div>

<div class="container">
  <?php if ($lead): ?>
  <section class="lead rule" aria-label="Nota principal">
    <div>
      <span class="card-kicker"><?= qpv_e(qpv_categoria_nombre($lead['category'])) ?></span>
      <h2 class="display lead-title"><a href="<?= esc_url($lead['url']) ?>"><?= qpv_e($lead['title']) ?></a></h2>
      <p class="lead-dek"><?= qpv_e($lead['dek']) ?></p>
      <?php qpv_meta($lead); ?>
      <?php if ($leadMore): ?>
        <div class="lead-more">
          <?php foreach ($leadMore as $n): ?>
            <article class="lead-more-item"><h3 class="headline"><a href="<?= esc_url($n['url']) ?>"><?= qpv_e($n['title']) ?></a></h3><?php qpv_meta($n); ?></article>
          <?php endforeach; ?>
        </div>
      <?php endif; ?>
    </div>
    <a href="<?= esc_url($lead['url']) ?>" class="lead-media" aria-hidden="true" tabindex="-1"><?php qpv_visual($lead, ['priority' => true]); ?></a>
  </section>
  <?php else: ?>
    <div class="empty-state section"><h3>Muy pronto, las noticias de Vallarta</h3><p>Todavía no hay notas publicadas.</p></div>
  <?php endif; ?>

  <?php if ($trio): ?>
  <section class="trio rule" aria-label="Más notas destacadas">
    <?php foreach ($trio as $n) qpv_card($n, ['compact' => true, 'square' => true]); ?>
  </section>
  <?php endif; ?>
</div>

<?php if (!qpv_ad_slot('home')): ?>
<aside class="ad-band" aria-label="Publicidad"><div class="container"><div class="ad-label">Publicidad</div>
  <a href="<?= esc_url(home_url('/conecta/')) ?>"><img src="<?= esc_url(qpv_asset('media/byd-banner.gif')) ?>" alt="BYD Puerto Vallarta — Vive Vallarta en modo 100% eléctrico"></a>
</div></aside>
<?php endif; ?>

<?php if ($feature): ?>
<div class="container section">
  <?php qpv_section_head('Ahora en Vallarta', ['href' => home_url('/ahora/'), 'label' => 'Ver todo']); ?>
  <div class="split">
    <div class="timeline">
      <?php foreach ($timeline as $n): ?>
      <article class="timeline-item">
        <div class="timeline-time"><strong><?= qpv_e(qpv_hora($n['publishedAt'])) ?></strong><span><?= qpv_e(qpv_fecha_corta($n['publishedAt'])) ?></span></div>
        <span class="timeline-rail" aria-hidden="true"></span>
        <div><h3 class="headline"><a href="<?= esc_url($n['url']) ?>"><?= qpv_e($n['title']) ?></a></h3></div>
      </article>
      <?php endforeach; ?>
    </div>
    <article class="feature">
      <a href="<?= esc_url($feature['url']) ?>" class="lead-media" aria-hidden="true" tabindex="-1"><?php qpv_visual($feature); ?></a>
      <span class="card-kicker"><?= qpv_e(qpv_categoria_nombre($feature['category'])) ?></span>
      <h3 class="display feature-title" style="margin-top:8px"><a href="<?= esc_url($feature['url']) ?>"><?= qpv_e($feature['title']) ?></a></h3>
      <p class="lead-dek"><?= qpv_e($feature['dek']) ?></p>
      <?php qpv_meta($feature); ?>
    </article>
  </div>
</div>
<?php endif; ?>

<?php if ($reels): ?>
<div class="container section">
  <?php qpv_section_head('Reels', ['sub' => 'Lo último en video desde nuestra página de Facebook', 'href' => $fbReels, 'label' => 'Ver en Facebook']); ?>
  <div class="carousel-wrap">
    <button class="carousel-nav prev" aria-label="Reels anteriores">‹</button>
    <div class="carousel-row reels-row">
      <?php foreach ($reels as $r): ?>
        <button type="button" class="reel-card" data-reel="<?= esc_attr($r['url']) ?>" aria-label="Ver reel: <?= esc_attr($r['description'] ?: 'sin descripción') ?>">
          <span class="reel-thumb"><img src="<?= esc_url($r['thumbnail'] ?? '') ?>" alt="" loading="lazy" referrerpolicy="no-referrer"><span class="reel-play"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5.5v13l11-6.5-11-6.5Z" fill="currentColor"/></svg></span></span>
          <?php if (!empty($r['description'])): ?><span class="reel-caption"><?= qpv_e($r['description']) ?></span><?php endif; ?>
          <?php if (!empty($r['createdAt'])): ?><span class="reel-time"><?= qpv_e(qpv_hace($r['createdAt'])) ?></span><?php endif; ?>
        </button>
      <?php endforeach; ?>
      <a class="reel-card reel-more" href="<?= esc_url($fbReels) ?>" target="_blank" rel="noopener noreferrer"><span class="reel-thumb"><span>Ver todos en Facebook →</span></span></a>
    </div>
    <button class="carousel-nav next" aria-label="Más reels">›</button>
  </div>
</div>
<?php endif; ?>

<?php if ($explica): $el = $explica[0]; ?>
<section class="band surface-paper">
  <div class="container">
    <?php qpv_section_head('Vallarta Explica', ['sub' => 'Entendemos lo que importa', 'href' => home_url('/explica/'), 'label' => 'Ver todos']); ?>
    <div class="split split-even">
      <article class="feature">
        <a href="<?= esc_url($el['url']) ?>" class="lead-media" aria-hidden="true" tabindex="-1"><?php qpv_visual($el, ['seccion' => 'Vallarta Explica']); ?></a>
        <h3 class="feature-title-serif"><a href="<?= esc_url($el['url']) ?>"><?= qpv_e($el['title']) ?></a></h3>
        <p class="lead-dek"><?= qpv_e($el['dek']) ?></p>
      </article>
      <div class="thumb-list">
        <?php foreach (array_slice($explica, 1, 3) as $e): ?>
          <a href="<?= esc_url($e['url']) ?>" class="thumb-list-item"><h3 class="headline"><?= qpv_e($e['title']) ?></h3><div class="thumb-list-media"><?php qpv_visual($e, ['credito' => false, 'seccion' => 'Vallarta Explica']); ?></div></a>
        <?php endforeach; ?>
      </div>
    </div>
  </div>
</section>
<?php endif; ?>

<?php if ($more): ?>
<div class="container section">
  <?php qpv_section_head('Más noticias', ['href' => home_url('/categoria/ultima-hora/'), 'label' => 'Ver todas']); ?>
  <div class="grid grid-4"><?php foreach ($more as $n) qpv_card($n, ['compact' => true]); ?></div>
</div>
<?php endif; ?>

<div class="container section-tight">
  <section id="newsletter" class="newsletter-block surface-stone" aria-label="Boletín">
    <img src="<?= esc_url(qpv_asset('brand/logo-transparent.png')) ?>" alt="">
    <h2>Buenos días, Vallarta</h2>
    <p>Recibe lo más importante cada mañana, directo en tu correo.</p>
    <?php qpv_newsletter_form(); ?>
  </section>
</div>

<?php if ($eventos): ?>
<div class="container section">
  <?php qpv_section_head('Vive Vallarta', ['sub' => 'Qué hacer en la ciudad', 'href' => home_url('/agenda/'), 'label' => 'Ver agenda']); ?>
  <div class="carousel-wrap">
    <button class="carousel-nav prev" aria-label="Anterior">‹</button>
    <div class="carousel-row">
      <?php foreach ($eventos as $e): ?>
        <a href="<?= esc_url(home_url('/agenda/' . $e['slug'] . '/')) ?>" class="tall-card carousel-item quarter">
          <img src="<?= esc_url(qpv_foto($e['image'])) ?>" alt="" loading="lazy" class="qpv-fill">
          <div class="tall-card-body">
            <span class="tall-card-kicker"><?= qpv_e($e['category'] . ' · ' . qpv_evento_fecha($e)) ?></span>
            <h3 class="tall-card-title"><?= qpv_e($e['title']) ?></h3>
            <span class="tall-card-meta"><?= qpv_e($e['location']) ?></span>
          </div>
        </a>
      <?php endforeach; ?>
    </div>
    <button class="carousel-nav next" aria-label="Siguiente">›</button>
  </div>
</div>
<?php endif; ?>

<div class="container section">
  <?php qpv_section_head('Guía de negocios', ['href' => home_url('/conecta/'), 'label' => 'Anúnciate']); ?>
  <div class="cta-strip">
    <div><span class="card-kicker">Vallarta Conecta</span><h3>Impulsa tu negocio con visibilidad real y conectada con tu audiencia</h3></div>
    <a class="btn btn-primary" href="<?= esc_url(home_url('/conecta/')) ?>">Conoce más</a>
  </div>
</div>
<?php get_footer();
