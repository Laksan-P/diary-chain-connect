import 'dart:async';
import 'package:flutter/material.dart';
import 'package:connectivity_plus/connectivity_plus.dart';
import 'package:hive_flutter/hive_flutter.dart';
import 'package:uuid/uuid.dart';
import 'api_service.dart';

class OfflineService {
  static const String pendingActionsBoxName = 'pending_actions';
  static const String cachedDataBoxName = 'cached_data';
  final _api = ApiService();
  final _uuid = const Uuid();
  
  final _connectivity = Connectivity();
  final _syncController = StreamController<bool>.broadcast();
  
  Stream<bool> get connectivityStream => _syncController.stream;
  bool _isOnline = true;
  bool get isOnline => _isOnline;

  static final OfflineService _instance = OfflineService._internal();
  factory OfflineService() => _instance;
  OfflineService._internal();

  Future<void> init() async {
    await Hive.initFlutter();
    await Hive.openBox(pendingActionsBoxName);
    await Hive.openBox(cachedDataBoxName);
    
    // Initial check
    final result = await _connectivity.checkConnectivity();
    _isOnline = !result.contains(ConnectivityResult.none);
    _syncController.add(_isOnline);

    if (_isOnline) {
      syncPendingActions();
      preCacheLookupData();
    }

    // Listen for changes
    _connectivity.onConnectivityChanged.listen((results) {
      final wasOffline = !_isOnline;
      _isOnline = !results.contains(ConnectivityResult.none);
      _syncController.add(_isOnline);
      
      if (_isOnline && wasOffline) {
        syncPendingActions();
        preCacheLookupData();
      }
    });
  }

  Future<void> preCacheLookupData() async {
    if (!_isOnline) return;
    try {
      final centers = await _api.get('/chilling-centers?action=list');
      await saveCachedData('chilling_centers', centers);
    } catch (e) {
      debugPrint("Lookup pre-cache failed: $e");
    }
  }

  // --- Caching Logic ---
  Future<void> saveCachedData(String key, dynamic data) async {
    final box = Hive.box(cachedDataBoxName);
    await box.put(key, data);
  }

  dynamic getCachedData(String key) {
    final box = Hive.box(cachedDataBoxName);
    return box.get(key);
  }

  // --- Pending Actions ---
  Future<void> addPendingAction(String path, String method, Map<String, dynamic> body) async {
    final box = Hive.box(pendingActionsBoxName);
    final id = _uuid.v4();
    await box.put(id, {
      'id': id,
      'path': path,
      'method': method,
      'body': body,
      'timestamp': DateTime.now().toIso8601String(),
    });
  }

  List<dynamic> getPendingActions() {
    final box = Hive.box(pendingActionsBoxName);
    return box.values.toList();
  }

  Future<void> syncPendingActions() async {
    if (!_isOnline) return;
    
    final box = Hive.box(pendingActionsBoxName);
    final actions = box.toMap();
    
    for (var entry in actions.entries) {
      final action = entry.value as Map;
      try {
        final path = action['path'] as String;
        final method = action['method'] as String;
        final body = Map<String, dynamic>.from(action['body'] as Map);
        
        // Add unique ID to prevent duplicates if not already present
        body['offline_id'] = action['id'];

        if (method == 'POST') {
          await _api.post(path, body);
        } else if (method == 'PATCH') {
          await _api.patch(path, body);
        } else if (method == 'PUT') {
          await _api.put(path, body);
        }
        
        await box.delete(entry.key);
      } catch (e) {
        // Using debugPrint from material.dart
        debugPrint('Failed to sync action ${entry.key}: $e');
        // Keep in box to retry later
      }
    }
  }
}
