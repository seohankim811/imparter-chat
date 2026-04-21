using System.Collections;
using UnityEngine;

namespace LostCity.Camera
{
    public class RTSCameraController : MonoBehaviour
    {
        [Header("Pan")]
        [SerializeField] private float _panSpeed = 20f;
        [SerializeField] private float _edgePanThreshold = 20f;

        [Header("Zoom")]
        [SerializeField] private float _zoomSpeed = 5f;
        [SerializeField] private float _minHeight = 5f;
        [SerializeField] private float _maxHeight = 40f;

        [Header("Bounds")]
        [SerializeField] private Vector2 _mapMin = new(-50, -50);
        [SerializeField] private Vector2 _mapMax = new(50, 50);

        private UnityEngine.Camera _cam;
        private Vector3 _shakeOffset;

        private void Awake()
        {
            _cam = GetComponent<UnityEngine.Camera>();
        }

        private void Update()
        {
            HandlePan();
            HandleZoom();
            ClampPosition();
        }

        private void LateUpdate()
        {
            transform.position += _shakeOffset;
        }

        private void HandlePan()
        {
            Vector3 move = Vector3.zero;
            var mouse = Input.mousePosition;

            // Edge pan
            if (mouse.x < _edgePanThreshold) move.x -= 1f;
            if (mouse.x > Screen.width - _edgePanThreshold) move.x += 1f;
            if (mouse.y < _edgePanThreshold) move.z -= 1f;
            if (mouse.y > Screen.height - _edgePanThreshold) move.z += 1f;

            // WASD pan
            move.x += Input.GetAxis("Horizontal");
            move.z += Input.GetAxis("Vertical");

            // Middle-mouse drag
            if (Input.GetMouseButton(2))
            {
                move.x -= Input.GetAxis("Mouse X");
                move.z -= Input.GetAxis("Mouse Y");
            }

            transform.position += move.normalized * _panSpeed * Time.deltaTime;
        }

        private void HandleZoom()
        {
            float scroll = Input.GetAxis("Mouse ScrollWheel");
            Vector3 pos = transform.position;
            pos.y -= scroll * _zoomSpeed * 10f;
            pos.y = Mathf.Clamp(pos.y, _minHeight, _maxHeight);
            transform.position = pos;
        }

        private void ClampPosition()
        {
            Vector3 pos = transform.position;
            pos.x = Mathf.Clamp(pos.x, _mapMin.x, _mapMax.x);
            pos.z = Mathf.Clamp(pos.z, _mapMin.y, _mapMax.y);
            transform.position = pos;
        }

        public void FocusOn(Vector3 worldPosition)
        {
            Vector3 pos = transform.position;
            pos.x = worldPosition.x;
            pos.z = worldPosition.z;
            transform.position = pos;
        }

        public void ShakeCamera(float intensity, float duration)
        {
            StartCoroutine(DoShake(intensity, duration));
        }

        private IEnumerator DoShake(float intensity, float duration)
        {
            float elapsed = 0f;
            while (elapsed < duration)
            {
                _shakeOffset = Random.insideUnitSphere * intensity;
                _shakeOffset.y = 0f;
                elapsed += Time.deltaTime;
                yield return null;
            }
            _shakeOffset = Vector3.zero;
        }
    }
}
