<?php
if (!defined('ABSPATH')) exit;
$activas = qpv_categorias_activas();
$preferencia = ['seguridad', 'gobierno', 'comunidad', 'turismo', 'clima', 'servicios', 'transito', 'playas'];
$primarias = array_slice(array_values(array_filter($preferencia, fn($s) => in_array($s, $activas, true))), 0, 2);
if (!$primarias) $primarias = ['gobierno', 'comunidad'];
$nav = array_merge(
    [['/proteccion-civil/', 'Protección Civil', true], ['/reporte/', 'Reporte Ciudadano', true], ['/trafico/', 'Tráfico', false]],
    array_map(fn($s) => ["/categoria/$s/", qpv_categoria_nombre($s), false], $primarias),
    [['/explica/', 'Explica', false]]
);
$ruta = '/' . trim(parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH), '/') . '/';
$secciones = [['/', 'Inicio'], ['/proteccion-civil/', 'Protección Civil'], ['/trafico/', 'QPV al Volante'], ['/reporte/', 'Reporte Ciudadano'],
    ['/ahora/', 'Vallarta Ahora'], ['/explica/', 'Vallarta Explica'], ['/agenda/', 'Vive Vallarta'], ['/guia/', 'Vallarta Guía'],
    ['/mi-vallarta/', 'Mi Vallarta'], ['/pregunta/', 'Pregúntale a Vallarta']];
$cats = array_filter(QPV_CATEGORIAS, fn($n, $s) => $s === 'ultima-hora' || !$activas || in_array($s, $activas, true), ARRAY_FILTER_USE_BOTH);
$logo = qpv_asset('brand/logo-transparent.png');
$hoy = qpv_hoy('j \d\e F \d\e Y');
$livePill = '<a href="' . esc_url(home_url('/ahora/')) . '" class="live-pill"><span class="live-dot"></span> Ahora</a>';
$navLinks = function () use ($nav, $ruta) {
    foreach ($nav as [$href, $label, $alert]) {
        $cls = trim(($ruta === $href ? 'active ' : '') . ($alert ? 'nav-alert' : ''));
        echo '<a href="' . esc_url(home_url($href)) . '"' . ($cls ? ' class="' . $cls . '"' : '') . '>' . qpv_e($label) . '</a>';
    }
    echo '<button type="button" data-qpv-menu-open aria-haspopup="dialog" aria-expanded="false">Más ' . qpv_icono('chevron') . '</button>';
};
?><!doctype html>
<html <?php language_attributes(); ?>>
<head>
<meta charset="<?php bloginfo('charset'); ?>">
<meta name="viewport" content="width=device-width, initial-scale=1">
<link rel="icon" href="<?= esc_url(qpv_asset('brand/logo.png')) ?>">
<?php wp_head(); ?>
</head>
<body <?php body_class(); ?>>
<a href="#main" class="skip-link">Saltar al contenido</a>

<header class="site-header">
  <div class="container">
    <div class="masthead">
      <div class="masthead-left">
        <a href="<?= esc_url(home_url('/buscar/')) ?>" class="icon-link" aria-label="Buscar" title="Buscar"><?= qpv_icono('buscar') ?></a>
        <span class="masthead-date"><?= qpv_e($hoy) ?></span>
      </div>
      <a href="<?= esc_url(home_url('/')) ?>" class="brand" aria-label="Qué Pasa Vallarta — inicio">
        <img src="<?= esc_url($logo) ?>" alt="Qué Pasa Vallarta" class="brand-logo">
      </a>
      <div class="masthead-right">
        <a href="<?= esc_url(home_url('/reporte/')) ?>" class="btn btn-reporte" aria-label="Manda tu reporte ciudadano">📷 <span>Reporta</span></a>
        <a href="<?= esc_url(home_url('/#newsletter')) ?>" class="btn btn-outline">Suscríbete</a>
        <span class="mobile-only"><?= $livePill ?></span>
        <a href="<?= esc_url(home_url('/buscar/')) ?>" class="icon-link mobile-only" aria-label="Buscar"><?= qpv_icono('buscar') ?></a>
        <button type="button" class="icon-link nav-toggle" aria-label="Abrir menú" aria-haspopup="dialog" aria-expanded="false" data-qpv-menu-open><?= qpv_icono('menu') ?></button>
      </div>
    </div>
    <nav class="primary-nav" aria-label="Navegación principal">
      <?= $livePill ?>
      <?php $navLinks(); ?>
    </nav>
  </div>
</header>

<div class="compact-bar" inert data-qpv-compact>
  <div class="container compact-bar-inner">
    <div class="compact-left">
      <a href="<?= esc_url(home_url('/')) ?>" class="brand" aria-label="Qué Pasa Vallarta — inicio"><img src="<?= esc_url($logo) ?>" alt="" class="brand-logo"></a>
      <?= $livePill ?>
    </div>
    <nav class="compact-nav" aria-label="Navegación principal (barra fija)"><?php $navLinks(); ?></nav>
    <div class="compact-right">
      <a href="<?= esc_url(home_url('/reporte/')) ?>" class="btn btn-reporte btn-sm">📷 <span>Reporta</span></a>
      <a href="<?= esc_url(home_url('/#newsletter')) ?>" class="btn btn-outline btn-sm">Suscríbete</a>
    </div>
  </div>
</div>

<div class="site-menu" role="dialog" aria-modal="true" aria-label="Menú" hidden data-qpv-menu>
  <div class="container">
    <div class="site-menu-head">
      <a href="<?= esc_url(home_url('/')) ?>" class="brand" aria-label="Qué Pasa Vallarta — inicio"><img src="<?= esc_url($logo) ?>" alt="Qué Pasa Vallarta" class="brand-logo"></a>
      <button type="button" class="icon-link" aria-label="Cerrar menú" data-qpv-menu-close><?= qpv_icono('cerrar') ?></button>
    </div>
    <div class="site-menu-grid">
      <div>
        <h2>Secciones</h2>
        <nav class="site-menu-list" aria-label="Secciones">
          <?php foreach ($secciones as [$h, $l]) echo '<a href="' . esc_url(home_url($h)) . '">' . qpv_e($l) . '</a>'; ?>
        </nav>
      </div>
      <div>
        <h2>Categorías</h2>
        <nav class="site-menu-cats" aria-label="Categorías">
          <?php foreach ($cats as $s => $n) echo '<a href="' . esc_url(home_url("/categoria/$s/")) . '">' . qpv_e($n) . '</a>'; ?>
        </nav>
      </div>
      <div>
        <h2>Opciones</h2>
        <div class="site-menu-actions">
          <a href="<?= esc_url(home_url('/#newsletter')) ?>" class="btn btn-primary" data-qpv-menu-close>Suscríbete al boletín</a>
          <a href="<?= esc_url(home_url('/buscar/')) ?>" class="btn btn-outline">Buscar</a>
          <button type="button" class="btn btn-outline" data-qpv-tema>Cambiar tema claro / oscuro</button>
        </div>
      </div>
    </div>
  </div>
</div>

<main id="main">
