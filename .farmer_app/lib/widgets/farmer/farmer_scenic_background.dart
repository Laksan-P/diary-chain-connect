import 'dart:ui';

import 'package:flutter/material.dart';
import '../../services/hero_background_service.dart';
import '../../theme/ambient_theme.dart';
import '../../theme/design_tokens.dart';

/// Full-bleed dairy/farm hero with subtle blur, readable overlay, and bottom fade.
class FarmerScenicBackground extends StatefulWidget {
  final Widget? child;
  final double height;
  final String? assetPath;
  final String? weatherCondition;
  final bool showBottomFade;
  final bool animate;
  final bool roundedBottom;
  final bool welcomeScreen;
  final bool headerReadable;
  final bool fullScreen;
  final Color? fadeToColor;

  const FarmerScenicBackground({
    super.key,
    this.child,
    this.height = HeroBackgroundService.homeHeroHeight,
    this.assetPath,
    this.weatherCondition,
    this.showBottomFade = true,
    this.animate = true,
    this.roundedBottom = false,
    this.welcomeScreen = false,
    this.headerReadable = false,
    this.fullScreen = false,
    this.fadeToColor,
  });

  @override
  State<FarmerScenicBackground> createState() => _FarmerScenicBackgroundState();
}

class _FarmerScenicBackgroundState extends State<FarmerScenicBackground>
    with SingleTickerProviderStateMixin {
  late AnimationController _fadeController;
  late Animation<double> _fadeAnimation;
  late String _resolvedPath;

  @override
  void initState() {
    super.initState();
    _resolvedPath = _resolvePath();
    _fadeController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 650),
    );
    _fadeAnimation = CurvedAnimation(
      parent: _fadeController,
      curve: Curves.easeOut,
    );
    if (widget.animate) {
      _fadeController.forward();
    } else {
      _fadeController.value = 1;
    }
  }

  @override
  void didUpdateWidget(FarmerScenicBackground oldWidget) {
    super.didUpdateWidget(oldWidget);
    final nextPath = _resolvePath();
    if (nextPath != _resolvedPath ||
        oldWidget.weatherCondition != widget.weatherCondition ||
        oldWidget.assetPath != widget.assetPath) {
      setState(() => _resolvedPath = nextPath);
      if (widget.animate) {
        _fadeController.forward(from: 0);
      }
    }
  }

  @override
  void dispose() {
    _fadeController.dispose();
    super.dispose();
  }

  String _resolvePath() {
    if (widget.welcomeScreen || widget.assetPath == HeroBackgroundService.welcome) {
      return HeroBackgroundService.welcome;
    }
    return widget.assetPath ??
        HeroBackgroundService.resolve(weatherCondition: widget.weatherCondition);
  }

  @override
  Widget build(BuildContext context) {
    final period = HeroBackgroundService.greetingPeriodForTime();
    final gradient = AmbientTheme.headerGradient(context);
    final scaffoldColor = Theme.of(context).scaffoldBackgroundColor;
    final fadeTarget = widget.fadeToColor ?? scaffoldColor;
    final alignment = HeroBackgroundService.alignmentForAsset(
      _resolvedPath,
      welcomeScreen: widget.welcomeScreen,
    );
    final fallbackPath = HeroBackgroundService.assetFallback(_resolvedPath);

    final heroBody = SizedBox(
      height: widget.fullScreen ? null : widget.height,
      width: double.infinity,
      child: Stack(
        fit: StackFit.expand,
        children: [
          Positioned.fill(
            child: RepaintBoundary(
              child: FadeTransition(
                opacity: _fadeAnimation,
                child: _FarmHeroImage(
                  assetPath: _resolvedPath,
                  alignment: alignment,
                  fallbackPath: fallbackPath,
                  gradient: gradient,
                  period: period,
                  isDark: Theme.of(context).brightness == Brightness.dark,
                  blurSigma: widget.welcomeScreen
                      ? HeroBackgroundService.welcomeHeroBlurSigma
                      : HeroBackgroundService.homeHeroBlurSigma,
                ),
              ),
            ),
          ),
          Positioned.fill(
            child: DecoratedBox(
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  begin: Alignment.topCenter,
                  end: Alignment.bottomCenter,
                  colors: [
                    Colors.black.withValues(alpha: widget.headerReadable ? 0.32 : 0.22),
                    Colors.black.withValues(alpha: 0.05),
                    Colors.black.withValues(
                      alpha: widget.showBottomFade ? 0.10 : 0.38,
                    ),
                  ],
                  stops: const [0.0, 0.50, 1.0],
                ),
              ),
            ),
          ),
          if (widget.headerReadable) ...[
            Positioned(
              left: 0,
              right: 0,
              top: 0,
              height: 128,
              child: DecoratedBox(
                decoration: BoxDecoration(
                  gradient: LinearGradient(
                    begin: Alignment.topCenter,
                    end: Alignment.bottomCenter,
                    colors: [
                      Colors.black.withValues(alpha: 0.50),
                      Colors.transparent,
                    ],
                  ),
                ),
              ),
            ),
            Positioned(
              left: 0,
              right: 0,
              bottom: 0,
              height: 200,
              child: DecoratedBox(
                decoration: BoxDecoration(
                  gradient: LinearGradient(
                    begin: Alignment.topCenter,
                    end: Alignment.bottomCenter,
                    colors: [
                      Colors.transparent,
                      Colors.black.withValues(alpha: 0.28),
                      Colors.black.withValues(alpha: 0.42),
                    ],
                    stops: const [0.0, 0.55, 1.0],
                  ),
                ),
              ),
            ),
            Positioned(
              left: 0,
              top: 0,
              bottom: 0,
              width: 180,
              child: DecoratedBox(
                decoration: BoxDecoration(
                  gradient: LinearGradient(
                    begin: Alignment.centerLeft,
                    end: Alignment.centerRight,
                    colors: [
                      Colors.black.withValues(alpha: 0.22),
                      Colors.transparent,
                    ],
                  ),
                ),
              ),
            ),
          ],
          if (widget.child != null) Positioned.fill(child: widget.child!),
          if (widget.showBottomFade)
            Positioned(
              left: 0,
              right: 0,
              bottom: 0,
              height: 110,
              child: DecoratedBox(
                decoration: BoxDecoration(
                  gradient: LinearGradient(
                    begin: Alignment.topCenter,
                    end: Alignment.bottomCenter,
                    colors: [
                      Colors.transparent,
                      fadeTarget.withValues(alpha: 0.40),
                      fadeTarget.withValues(alpha: 0.88),
                      fadeTarget,
                    ],
                    stops: const [0.0, 0.38, 0.78, 1.0],
                  ),
                ),
              ),
            ),
        ],
      ),
    );

    if (widget.fullScreen) {
      return SizedBox.expand(child: heroBody);
    }

    if (!widget.roundedBottom) return heroBody;

    return ClipRRect(
      borderRadius: const BorderRadius.only(
        bottomLeft: Radius.circular(32),
        bottomRight: Radius.circular(32),
      ),
      child: heroBody,
    );
  }
}

class _FarmHeroImage extends StatelessWidget {
  final String assetPath;
  final String fallbackPath;
  final Alignment alignment;
  final LinearGradient gradient;
  final AmbientPeriod period;
  final bool isDark;
  final double blurSigma;

  const _FarmHeroImage({
    required this.assetPath,
    required this.fallbackPath,
    required this.alignment,
    required this.gradient,
    required this.period,
    required this.isDark,
    this.blurSigma = 0,
  });

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(
      builder: (context, constraints) {
        final width = constraints.maxWidth.isFinite ? constraints.maxWidth : MediaQuery.sizeOf(context).width;
        final height = constraints.maxHeight.isFinite ? constraints.maxHeight : MediaQuery.sizeOf(context).height;

        Widget image = Image.asset(
          assetPath,
          fit: BoxFit.cover,
          alignment: alignment,
          width: width,
          height: height,
          filterQuality: FilterQuality.high,
          gaplessPlayback: true,
          errorBuilder: (_, __, ___) {
            if (assetPath == fallbackPath) {
              return DecoratedBox(
                decoration: BoxDecoration(gradient: gradient),
                child: CustomPaint(
                  painter: _FarmFallbackPainter(isDark: isDark, period: period),
                ),
              );
            }
            return _FarmHeroImage(
              assetPath: fallbackPath,
              fallbackPath: fallbackPath,
              alignment: HeroBackgroundService.alignmentForAsset(fallbackPath),
              gradient: gradient,
              period: period,
              isDark: isDark,
              blurSigma: blurSigma,
            );
          },
        );

        if (blurSigma > 0) {
          image = ClipRect(
            child: ImageFiltered(
              imageFilter: ImageFilter.blur(
                sigmaX: blurSigma,
                sigmaY: blurSigma,
              ),
              child: Transform.scale(
                scale: 1.02,
                child: SizedBox(
                  width: width,
                  height: height,
                  child: image,
                ),
              ),
            ),
          );
        }

        return SizedBox(width: width, height: height, child: image);
      },
    );
  }
}

class _FarmFallbackPainter extends CustomPainter {
  final bool isDark;
  final AmbientPeriod period;

  _FarmFallbackPainter({required this.isDark, required this.period});

  @override
  void paint(Canvas canvas, Size size) {
    final base = isDark
        ? AppColors.deepForest.withValues(alpha: 0.45)
        : AppColors.primaryGreen.withValues(alpha: 0.22);

    final path = Path()
      ..moveTo(0, size.height * 0.72)
      ..quadraticBezierTo(
        size.width * 0.25,
        size.height * 0.58,
        size.width * 0.5,
        size.height * 0.68,
      )
      ..quadraticBezierTo(
        size.width * 0.78,
        size.height * 0.78,
        size.width,
        size.height * 0.62,
      )
      ..lineTo(size.width, size.height)
      ..lineTo(0, size.height)
      ..close();

    canvas.drawPath(path, Paint()..color = base);
  }

  @override
  bool shouldRepaint(covariant _FarmFallbackPainter oldDelegate) =>
      oldDelegate.period != period || oldDelegate.isDark != isDark;
}
