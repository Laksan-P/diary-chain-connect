import 'dart:io';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:lucide_icons/lucide_icons.dart';
import 'package:provider/provider.dart';
import 'package:image_picker/image_picker.dart';
import '../providers/auth_provider.dart';
import '../services/profile_photo_service.dart';
import '../services/translations.dart';
import '../theme/design_tokens.dart';
import 'bouncing_button.dart';

class ProfileAvatar extends StatelessWidget {
  final double radius;
  final String locale;
  final bool editable;
  final VoidCallback? onChanged;

  const ProfileAvatar({
    super.key,
    this.radius = 54,
    required this.locale,
    this.editable = false,
    this.onChanged,
  });

  Future<void> _confirmRemove(BuildContext context, ProfilePhotoService photoService, String farmerId) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text(Translations.get('remove_profile_photo', locale)),
        content: Text(Translations.get('remove_photo_confirm', locale)),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: Text(Translations.get('cancel', locale)),
          ),
          TextButton(
            onPressed: () => Navigator.pop(ctx, true),
            style: TextButton.styleFrom(foregroundColor: AppColors.error),
            child: Text(Translations.get('remove', locale)),
          ),
        ],
      ),
    );

    if (confirmed == true) {
      await photoService.removePhoto(farmerId);
      onChanged?.call();
    }
  }

  void _showSheet(BuildContext context, String farmerId) {
    final photoService = context.read<ProfilePhotoService>();
    final hasPhoto = photoService.photoPathFor(farmerId) != null;

    showModalBottomSheet(
      context: context,
      backgroundColor: Colors.transparent,
      isScrollControlled: true,
      builder: (ctx) {
        final isDark = Theme.of(ctx).brightness == Brightness.dark;
        return AnimatedPadding(
          duration: const Duration(milliseconds: 220),
          padding: EdgeInsets.only(bottom: MediaQuery.viewInsetsOf(ctx).bottom),
          child: Container(
            margin: const EdgeInsets.all(16),
            padding: const EdgeInsets.fromLTRB(20, 12, 20, 24),
            decoration: BoxDecoration(
              color: isDark ? AppColors.darkCard : Colors.white,
              borderRadius: BorderRadius.circular(28),
            ),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Container(
                  width: 40,
                  height: 4,
                  decoration: BoxDecoration(
                    color: Colors.grey.withValues(alpha: 0.3),
                    borderRadius: BorderRadius.circular(2),
                  ),
                ),
                const SizedBox(height: 20),
                _sheetAction(
                  ctx,
                  LucideIcons.imagePlus,
                  hasPhoto
                      ? Translations.get('change_profile_photo', locale)
                      : Translations.get('add_profile_photo', locale),
                  () async {
                    Navigator.pop(ctx);
                    await photoService.pickAndSave(farmerId, source: ImageSource.gallery);
                    onChanged?.call();
                  },
                ),
                if (hasPhoto)
                  _sheetAction(
                    ctx,
                    LucideIcons.trash2,
                    Translations.get('remove_profile_photo', locale),
                    destructive: true,
                    () async {
                      Navigator.pop(ctx);
                      await _confirmRemove(context, photoService, farmerId);
                    },
                  ),
                const SizedBox(height: 8),
                TextButton(
                  onPressed: () => Navigator.pop(ctx),
                  child: Text(Translations.get('cancel', locale)),
                ),
              ],
            ),
          ),
        );
      },
    );
  }

  Widget _sheetAction(
    BuildContext context,
    IconData icon,
    String label,
    VoidCallback onTap, {
    bool destructive = false,
  }) {
    return ListTile(
      leading: Icon(icon, color: destructive ? AppColors.error : AppColors.primaryGreen),
      title: Text(
        label,
        style: TextStyle(
          fontWeight: FontWeight.w700,
          color: destructive ? AppColors.error : null,
        ),
      ),
      onTap: () {
        HapticFeedback.selectionClick();
        onTap();
      },
    );
  }

  @override
  Widget build(BuildContext context) {
    final user = context.watch<AuthProvider>().user;
    final photoService = context.watch<ProfilePhotoService>();
    final farmerId = user?['farmerId']?.toString() ?? '';
    final path = photoService.photoPathFor(farmerId);
    final isDark = Theme.of(context).brightness == Brightness.dark;

    final avatar = Container(
      padding: const EdgeInsets.all(3),
      decoration: BoxDecoration(
        shape: BoxShape.circle,
        gradient: LinearGradient(
          colors: [
            AppColors.primaryGreen.withValues(alpha: 0.8),
            AppColors.nestleBlue.withValues(alpha: 0.8),
          ],
        ),
      ),
      child: CircleAvatar(
        radius: radius,
        backgroundColor: isDark ? AppColors.darkSurface : AppColors.warmCream,
        backgroundImage: path != null ? FileImage(File(path)) : null,
        child: path == null
            ? Icon(
                LucideIcons.user,
                size: radius * 0.85,
                color: isDark ? AppColors.darkAccent : AppColors.primaryGreen,
              )
            : null,
      ),
    );

    if (!editable) return avatar;

    return BouncingButton(
      onTap: () {
        if (farmerId.isEmpty) return;
        _showSheet(context, farmerId);
      },
      child: Stack(
        clipBehavior: Clip.none,
        children: [
          avatar,
          Positioned(
            right: 0,
            bottom: 0,
            child: Container(
              padding: const EdgeInsets.all(6),
              decoration: BoxDecoration(
                color: AppColors.nestleBlue,
                shape: BoxShape.circle,
                border: Border.all(color: Colors.white, width: 2),
              ),
              child: const Icon(LucideIcons.camera, size: 14, color: Colors.white),
            ),
          ),
        ],
      ),
    );
  }
}
