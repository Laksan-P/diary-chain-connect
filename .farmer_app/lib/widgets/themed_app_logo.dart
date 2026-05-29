import 'package:flutter/material.dart';

enum ThemedAppLogoStyle { plain, welcome, auth, compact }

/// Theme-aware Nestlé farming cow logo.
class ThemedAppLogo extends StatelessWidget {
  static const lightAsset = 'assets/images/farmer/logo.png';
  static const darkAsset = 'assets/images/farmer/logo_dark.png';

  final double? size;
  final ThemedAppLogoStyle style;
  final BoxFit fit;

  const ThemedAppLogo({
    super.key,
    this.size,
    this.style = ThemedAppLogoStyle.plain,
    this.fit = BoxFit.contain,
  });

  static String assetFor(BuildContext context) {
    return Theme.of(context).brightness == Brightness.dark
        ? darkAsset
        : lightAsset;
  }

  double get _logoSize {
    if (size != null) return size!;
    return switch (style) {
      ThemedAppLogoStyle.welcome => 96,
      ThemedAppLogoStyle.auth => 88,
      ThemedAppLogoStyle.compact => 72,
      ThemedAppLogoStyle.plain => 72,
    };
  }

  @override
  Widget build(BuildContext context) {
    final logo = Image.asset(
      assetFor(context),
      width: _logoSize,
      height: _logoSize,
      fit: fit,
      filterQuality: FilterQuality.high,
    );

    if (style != ThemedAppLogoStyle.welcome) {
      return logo;
    }

    return DecoratedBox(
      decoration: BoxDecoration(
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.38),
            blurRadius: 28,
            offset: const Offset(0, 10),
          ),
        ],
      ),
      child: logo,
    );
  }
}
