using System;
using System.Collections.Generic;

namespace LostCity.Core
{
    public static class EventBus
    {
        private static readonly Dictionary<Type, List<Delegate>> _listeners = new();

        public static void Subscribe<T>(Action<T> listener)
        {
            var type = typeof(T);
            if (!_listeners.ContainsKey(type))
                _listeners[type] = new List<Delegate>();
            _listeners[type].Add(listener);
        }

        public static void Unsubscribe<T>(Action<T> listener)
        {
            var type = typeof(T);
            if (_listeners.ContainsKey(type))
                _listeners[type].Remove(listener);
        }

        public static void Publish<T>(T evt)
        {
            var type = typeof(T);
            if (!_listeners.ContainsKey(type)) return;

            foreach (var d in _listeners[type].ToArray())
                (d as Action<T>)?.Invoke(evt);
        }

        public static void Clear()
        {
            _listeners.Clear();
        }
    }
}
