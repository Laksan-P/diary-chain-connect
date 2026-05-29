import 'package:flutter/material.dart';
import '../../theme/design_tokens.dart';

class ShimmerBox extends StatefulWidget {
  final double width;
  final double height;
  final BorderRadius? borderRadius;

  const ShimmerBox({
    super.key,
    required this.width,
    required this.height,
    this.borderRadius,
  });

  @override
  State<ShimmerBox> createState() => _ShimmerBoxState();
}

class _ShimmerBoxState extends State<ShimmerBox> with SingleTickerProviderStateMixin {
  late AnimationController _controller;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1200),
    )..repeat();
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final base = isDark ? AppColors.darkCard : Colors.grey.shade200;
    final highlight = isDark ? Colors.white12 : Colors.white;

    return AnimatedBuilder(
      animation: _controller,
      builder: (context, child) {
        return Container(
          width: widget.width,
          height: widget.height,
          decoration: BoxDecoration(
            borderRadius: widget.borderRadius ?? BorderRadius.circular(AppRadii.md),
            gradient: LinearGradient(
              begin: Alignment(-1 + _controller.value * 2, 0),
              end: Alignment(-0.5 + _controller.value * 2, 0),
              colors: [base, highlight, base],
            ),
          ),
        );
      },
    );
  }
}

class HomeDashboardSkeleton extends StatelessWidget {
  const HomeDashboardSkeleton({super.key});

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const ShimmerBox(width: double.infinity, height: 280, borderRadius: BorderRadius.zero),
        Padding(
          padding: const EdgeInsets.all(16),
          child: Column(
            children: [
              const ShimmerBox(width: double.infinity, height: 160),
              const SizedBox(height: 16),
              Row(
                children: [
                  Expanded(child: ShimmerBox(width: double.infinity, height: 100)),
                  const SizedBox(width: 12),
                  Expanded(child: ShimmerBox(width: double.infinity, height: 100)),
                ],
              ),
            ],
          ),
        ),
      ],
    );
  }
}
