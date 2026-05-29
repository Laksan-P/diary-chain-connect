import 'dart:async';

import 'package:flutter/material.dart';

import '../../services/hero_background_service.dart';
import '../../services/translations.dart';

/// Greeting label that tracks local time and refreshes at period boundaries.
class TimeBasedGreeting extends StatefulWidget {
  final String locale;
  final TextStyle? style;
  final int? maxLines;
  final TextOverflow? overflow;

  const TimeBasedGreeting({
    super.key,
    required this.locale,
    this.style,
    this.maxLines,
    this.overflow,
  });

  @override
  State<TimeBasedGreeting> createState() => _TimeBasedGreetingState();
}

class _TimeBasedGreetingState extends State<TimeBasedGreeting> with WidgetsBindingObserver {
  Timer? _periodTimer;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    _scheduleNextRefresh();
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    _periodTimer?.cancel();
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed) {
      setState(() {});
      _scheduleNextRefresh();
    }
  }

  void _scheduleNextRefresh() {
    _periodTimer?.cancel();
    final wait = HeroBackgroundService.nextGreetingPeriodBoundary().difference(DateTime.now());
    _periodTimer = Timer(
      wait <= Duration.zero ? const Duration(minutes: 1) : wait,
      () {
        if (!mounted) return;
        setState(() {});
        _scheduleNextRefresh();
      },
    );
  }

  @override
  Widget build(BuildContext context) {
    return Text(
      Translations.get(HeroBackgroundService.greetingKeyForTime(), widget.locale),
      style: widget.style,
      maxLines: widget.maxLines,
      overflow: widget.overflow,
    );
  }
}
