import 'dart:io';
import 'package:flutter/foundation.dart';
import 'package:hive_flutter/hive_flutter.dart';
import 'package:path_provider/path_provider.dart';
import 'package:image_picker/image_picker.dart';

/// Local-only profile photo storage (device). Does not change API payloads.
class ProfilePhotoService extends ChangeNotifier {
  static const _boxName = 'profile_photos';
  final ImagePicker _picker = ImagePicker();
  Box? _box;

  Future<void> init() async {
    _box ??= await Hive.openBox(_boxName);
  }

  String? photoPathFor(String farmerId) {
    if (_box == null || farmerId.isEmpty) return null;
    final path = _box!.get(farmerId)?.toString();
    if (path == null || path.isEmpty) return null;
    if (!File(path).existsSync()) {
      _box!.delete(farmerId);
      return null;
    }
    return path;
  }

  Future<File?> pickAndSave(String farmerId, {ImageSource source = ImageSource.gallery}) async {
    await init();
    if (farmerId.isEmpty) return null;

    final picked = await _picker.pickImage(
      source: source,
      maxWidth: 1024,
      maxHeight: 1024,
      imageQuality: 85,
    );
    if (picked == null) return null;

    final dir = await getApplicationDocumentsDirectory();
    final photosDir = Directory('${dir.path}/profile_photos');
    if (!await photosDir.exists()) await photosDir.create(recursive: true);

    final dest = File('${photosDir.path}/$farmerId.jpg');
    await File(picked.path).copy(dest.path);
    await _box!.put(farmerId, dest.path);
    notifyListeners();
    return dest;
  }

  Future<void> removePhoto(String farmerId) async {
    await init();
    final existing = photoPathFor(farmerId);
    if (existing != null) {
      try {
        await File(existing).delete();
      } catch (_) {}
    }
    await _box!.delete(farmerId);
    notifyListeners();
  }
}
