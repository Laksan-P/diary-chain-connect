import 'package:flutter/material.dart';
import 'package:lucide_icons/lucide_icons.dart';
import 'package:farmer_app/main.dart';

class ToastService {
  static void show(BuildContext context, String message, {bool isError = false}) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final primary = const Color(0xFF1B264F);
    final primaryLight = const Color(0xFF274690);

    scaffoldMessengerKey.currentState?.removeCurrentSnackBar();
    scaffoldMessengerKey.currentState?.showSnackBar(
      SnackBar(
        content: Row(
          children: [
            Container(
              padding: const EdgeInsets.all(6),
              decoration: BoxDecoration(
                color: Colors.white.withValues(alpha: 0.15),
                shape: BoxShape.circle,
              ),
              child: Icon(
                isError ? LucideIcons.alertCircle : LucideIcons.checkCircle2,
                color: Colors.white,
                size: 18,
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Text(
                message,
                style: const TextStyle(
                  color: Colors.white,
                  fontWeight: FontWeight.bold,
                  fontSize: 14,
                  letterSpacing: -0.2,
                ),
              ),
            ),
          ],
        ),
        backgroundColor: isError ? Colors.red.shade900 : (isDark ? primaryLight : primary),
        behavior: SnackBarBehavior.floating,
        elevation: 12,
        margin: const EdgeInsets.fromLTRB(20, 0, 20, 40),
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
        duration: const Duration(seconds: 3),
      ),
    );
  }
}
