using System;
using UnityEngine;

namespace LostCity.Player
{
    public class PlayerInputHandler : MonoBehaviour
    {
        public static PlayerInputHandler Instance { get; private set; }

        public event Action<RaycastHit> OnLeftClickHit;
        public event Action<Vector3> OnRightClickWorld;
        public event Action<Rect> OnBoxSelectEnd;
        public event Action<int> OnAbilityKeyPressed; // 0=Q, 1=W, 2=E

        [SerializeField] private LayerMask _clickableLayer;
        [SerializeField] private float _boxSelectMinSize = 10f;

        private Camera _cam;
        private bool _isDragging;
        private Vector3 _dragStart;

        private void Awake()
        {
            if (Instance != null) { Destroy(gameObject); return; }
            Instance = this;
            _cam = Camera.main;
        }

        private void Update()
        {
            HandleLeftClick();
            HandleRightClick();
            HandleBoxSelect();
            HandleAbilityKeys();
        }

        private void HandleLeftClick()
        {
            if (!Input.GetMouseButtonDown(0)) return;

            Ray ray = _cam.ScreenPointToRay(Input.mousePosition);
            if (Physics.Raycast(ray, out RaycastHit hit, 500f, _clickableLayer))
                OnLeftClickHit?.Invoke(hit);

            _dragStart = Input.mousePosition;
            _isDragging = true;
        }

        private void HandleRightClick()
        {
            if (!Input.GetMouseButtonDown(1)) return;

            Ray ray = _cam.ScreenPointToRay(Input.mousePosition);
            if (Physics.Raycast(ray, out RaycastHit hit, 500f))
                OnRightClickWorld?.Invoke(hit.point);
        }

        private void HandleBoxSelect()
        {
            if (Input.GetMouseButtonUp(0) && _isDragging)
            {
                _isDragging = false;
                Rect dragRect = GetScreenRect(_dragStart, Input.mousePosition);
                if (dragRect.width > _boxSelectMinSize || dragRect.height > _boxSelectMinSize)
                    OnBoxSelectEnd?.Invoke(dragRect);
            }
        }

        private void HandleAbilityKeys()
        {
            if (Input.GetKeyDown(KeyCode.Q)) OnAbilityKeyPressed?.Invoke(0);
            if (Input.GetKeyDown(KeyCode.W)) OnAbilityKeyPressed?.Invoke(1);
            if (Input.GetKeyDown(KeyCode.E)) OnAbilityKeyPressed?.Invoke(2);
        }

        private void OnGUI()
        {
            if (_isDragging && Vector3.Distance(_dragStart, Input.mousePosition) > _boxSelectMinSize)
            {
                Rect rect = GetScreenRect(_dragStart, Input.mousePosition);
                DrawScreenRect(rect, new Color(0.3f, 0.7f, 1f, 0.25f));
                DrawScreenRectBorder(rect, 1f, new Color(0.3f, 0.7f, 1f));
            }
        }

        private static Rect GetScreenRect(Vector3 a, Vector3 b)
        {
            a.y = Screen.height - a.y;
            b.y = Screen.height - b.y;
            return new Rect(Mathf.Min(a.x, b.x), Mathf.Min(a.y, b.y),
                            Mathf.Abs(a.x - b.x), Mathf.Abs(a.y - b.y));
        }

        private static void DrawScreenRect(Rect rect, Color color)
        {
            GUI.color = color;
            GUI.DrawTexture(rect, Texture2D.whiteTexture);
            GUI.color = Color.white;
        }

        private static void DrawScreenRectBorder(Rect rect, float thickness, Color color)
        {
            DrawScreenRect(new Rect(rect.xMin, rect.yMin, rect.width, thickness), color);
            DrawScreenRect(new Rect(rect.xMin, rect.yMax - thickness, rect.width, thickness), color);
            DrawScreenRect(new Rect(rect.xMin, rect.yMin, thickness, rect.height), color);
            DrawScreenRect(new Rect(rect.xMax - thickness, rect.yMin, thickness, rect.height), color);
        }
    }
}
