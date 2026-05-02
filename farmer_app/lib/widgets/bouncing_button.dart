import 'package:flutter/material.dart';

/// Provides a smooth opacity fade on press (like native iOS buttons),
/// without any scaling or bouncing.
/// Kept the class name as `BouncingButton` for drop-in compatibility.
class BouncingButton extends StatefulWidget {
  final Widget child;
  final VoidCallback onTap;
  final double fadeOpacity;
  final Duration duration;

  const BouncingButton({
    super.key,
    required this.child,
    required this.onTap,
    this.fadeOpacity = 0.5, // Dims to 50% opacity when pressed
    this.duration = const Duration(milliseconds: 150), // Smooth fade time
  });

  @override
  State<BouncingButton> createState() => _BouncingButtonState();
}

class _BouncingButtonState extends State<BouncingButton> {
  bool _isPressed = false;

  void _handleTapDown(TapDownDetails details) {
    setState(() => _isPressed = true);
  }

  void _handleTapUp(TapUpDetails details) {
    setState(() => _isPressed = false);
    widget.onTap();
  }

  void _handleTapCancel() {
    setState(() => _isPressed = false);
  }

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTapDown: _handleTapDown,
      onTapUp: _handleTapUp,
      onTapCancel: _handleTapCancel,
      behavior: HitTestBehavior.opaque,
      child: AnimatedOpacity(
        duration: widget.duration,
        curve: Curves.easeInOut,
        opacity: _isPressed ? widget.fadeOpacity : 1.0,
        child: widget.child,
      ),
    );
  }
}
