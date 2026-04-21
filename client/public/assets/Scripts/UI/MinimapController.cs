using System.Collections;
using System.Collections.Generic;
using UnityEngine;
using UnityEngine.UI;
using LostCity.Core;
using LostCity.Units;
using LostCity.Buildings;

namespace LostCity.UI
{
    public class MinimapController : MonoBehaviour
    {
        [Header("References")]
        [SerializeField] private RawImage _minimapImage;
        [SerializeField] private Camera _minimapCamera;
        [SerializeField] private Camera _mainCamera;

        [Header("Dot Settings")]
        [SerializeField] private GameObject _dotPrefab;
        [SerializeField] private Transform _dotContainer;

        [Header("Map Bounds")]
        [SerializeField] private Vector2 _mapMin = new(-50, -50);
        [SerializeField] private Vector2 _mapMax = new(50, 50);

        private readonly Dictionary<MonoBehaviour, RectTransform> _dots = new();
        private Camera.RTSCameraController _camController;
        private RectTransform _minimapRect;

        private void Start()
        {
            _minimapRect = _minimapImage.GetComponent<RectTransform>();
            _camController = FindFirstObjectByType<Camera.RTSCameraController>();
            if (_mainCamera == null) _mainCamera = UnityEngine.Camera.main;

            StartCoroutine(RefreshDots());

            // Click on minimap to pan camera
            var trigger = _minimapImage.gameObject.AddComponent<UnityEngine.EventSystems.EventTrigger>();
            var entry = new UnityEngine.EventSystems.EventTrigger.Entry
            {
                eventID = UnityEngine.EventSystems.EventTriggerType.PointerClick
            };
            entry.callback.AddListener(OnMinimapClick);
            trigger.triggers.Add(entry);
        }

        private IEnumerator RefreshDots()
        {
            while (true)
            {
                yield return new WaitForSeconds(0.1f); // 10fps
                UpdateDots();
            }
        }

        private void UpdateDots()
        {
            var allUnits = FindObjectsByType<UnitBase>(FindObjectsSortMode.None);
            var allBuildings = FindObjectsByType<BuildingBase>(FindObjectsSortMode.None);

            var seen = new HashSet<MonoBehaviour>();

            foreach (var u in allUnits)
            {
                seen.Add(u);
                UpdateOrCreateDot(u, u.Faction, u.transform.position, 6f);
            }
            foreach (var b in allBuildings)
            {
                seen.Add(b);
                UpdateOrCreateDot(b, b.Faction, b.transform.position, 10f);
            }

            // Remove stale dots
            var toRemove = new List<MonoBehaviour>();
            foreach (var kv in _dots)
            {
                if (!seen.Contains(kv.Key))
                {
                    if (kv.Value != null) Destroy(kv.Value.gameObject);
                    toRemove.Add(kv.Key);
                }
            }
            foreach (var k in toRemove) _dots.Remove(k);
        }

        private void UpdateOrCreateDot(MonoBehaviour obj, Faction faction, Vector3 worldPos, float size)
        {
            if (!_dots.TryGetValue(obj, out var dot))
            {
                var go = _dotPrefab != null
                    ? Instantiate(_dotPrefab, _dotContainer)
                    : CreateDefaultDot(size);
                dot = go.GetComponent<RectTransform>();
                _dots[obj] = dot;
            }

            // Color by faction
            var img = dot.GetComponent<Image>();
            if (img != null)
                img.color = faction == Faction.ElfCouncil ? Color.cyan : Color.red;

            dot.anchoredPosition = WorldToMinimap(worldPos);
            dot.sizeDelta = Vector2.one * size;
        }

        private GameObject CreateDefaultDot(float size)
        {
            var go = new GameObject("Dot", typeof(RectTransform), typeof(Image));
            go.transform.SetParent(_dotContainer, false);
            go.GetComponent<RectTransform>().sizeDelta = Vector2.one * size;
            return go;
        }

        private Vector2 WorldToMinimap(Vector3 worldPos)
        {
            float tx = Mathf.InverseLerp(_mapMin.x, _mapMax.x, worldPos.x);
            float ty = Mathf.InverseLerp(_mapMin.y, _mapMax.y, worldPos.z);
            return new Vector2(
                tx * _minimapRect.rect.width - _minimapRect.rect.width * 0.5f,
                ty * _minimapRect.rect.height - _minimapRect.rect.height * 0.5f
            );
        }

        private void OnMinimapClick(UnityEngine.EventSystems.BaseEventData data)
        {
            var pointerData = data as UnityEngine.EventSystems.PointerEventData;
            if (pointerData == null || _camController == null) return;

            RectTransformUtility.ScreenPointToLocalPointInRectangle(
                _minimapRect, pointerData.position, null, out Vector2 local);

            float tx = (local.x + _minimapRect.rect.width * 0.5f) / _minimapRect.rect.width;
            float ty = (local.y + _minimapRect.rect.height * 0.5f) / _minimapRect.rect.height;

            Vector3 worldPos = new Vector3(
                Mathf.Lerp(_mapMin.x, _mapMax.x, tx),
                0,
                Mathf.Lerp(_mapMin.y, _mapMax.y, ty)
            );
            _camController.FocusOn(worldPos);
        }
    }
}
