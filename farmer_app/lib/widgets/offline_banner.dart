import 'package:flutter/material.dart';
import 'package:lucide_icons/lucide_icons.dart';
import '../services/offline_service.dart';
import '../services/translations.dart';
import '../screens/app_theme.dart';

class OfflineBanner extends StatelessWidget {
  final String locale;
  final EdgeInsets? padding;
  
  const OfflineBanner({
    super.key, 
    required this.locale,
    this.padding,
  });

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    
    return StreamBuilder<bool>(
      stream: OfflineService().connectivityStream,
      initialData: OfflineService().isOnline,
      builder: (context, snapshot) {
        final isOnline = snapshot.data ?? true;
        
        return AnimatedCrossFade(
          duration: const Duration(milliseconds: 600),
          firstChild: const SizedBox.shrink(),
          secondChild: Padding(
            padding: padding ?? const EdgeInsets.symmetric(horizontal: 16),
            child: Container(
              margin: const EdgeInsets.only(top: 12),
              padding: const EdgeInsets.symmetric(vertical: 12, horizontal: 20),
              decoration: BoxDecoration(
                color: isDark 
                    ? AppTheme.primary.withOpacity(0.9)
                    : Colors.blue.shade50,
                borderRadius: BorderRadius.circular(20),
                border: Border.all(
                  color: isDark ? Colors.white10 : Colors.blue.shade100,
                  width: 1,
                ),
              ),
              child: Row(
                children: [
                  Container(
                    padding: const EdgeInsets.all(8),
                    decoration: BoxDecoration(
                      color: isDark ? Colors.white10 : Colors.blue.shade100,
                      shape: BoxShape.circle,
                    ),
                    child: Icon(
                      LucideIcons.wifiOff, 
                      color: isDark ? Colors.white : Colors.blue.shade700, 
                      size: 16
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Text(
                          Translations.get('offline_mode_msg', locale),
                          style: TextStyle(
                            color: isDark ? Colors.white : Colors.blue.shade900,
                            fontSize: 13,
                            fontWeight: FontWeight.w800,
                            letterSpacing: -0.2,
                          ),
                        ),
                        Text(
                          "Syncing will resume when online",
                          style: TextStyle(
                            color: (isDark ? Colors.white : Colors.blue.shade700).withOpacity(0.7),
                            fontSize: 10,
                            fontWeight: FontWeight.w500,
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          ),
          crossFadeState: isOnline ? CrossFadeState.showFirst : CrossFadeState.showSecond,
          sizeCurve: Curves.easeInOutBack,
        );
      },
    );
  }
}
