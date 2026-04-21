using UnityEngine;
using LostCity.Data;
using LostCity.Core;

namespace LostCity.Buildings
{
    public class BuildingPlacer : MonoBehaviour
    {
        public static BuildingPlacer Instance { get; private set; }

        [SerializeField] private LayerMask _groundLayer;
        [SerializeField] private Material _validPlaceMaterial;
        [SerializeField] private Material _invalidPlaceMaterial;

        private BuildingData _pendingData;
        private GameObject _ghost;
        private bool _isPlacing;
        private Camera _cam;

        private void Awake()
        {
            if (Instance != null) { Destroy(gameObject); return; }
            Instance = this;
            _cam = Camera.main;
        }

        private void Update()
        {
            if (!_isPlacing || _ghost == null) return;

            Ray ray = _cam.ScreenPointToRay(Input.mousePosition);
            if (Physics.Raycast(ray, out RaycastHit hit, 500f, _groundLayer))
            {
                _ghost.transform.position = hit.point;
                bool valid = IsValidPosition(hit.point);
                SetGhostMaterial(valid ? _validPlaceMaterial : _invalidPlaceMaterial);

                if (Input.GetMouseButtonDown(0) && valid)
                    PlaceBuilding(hit.point);
            }

            if (Input.GetMouseButtonDown(1) || Input.GetKeyDown(KeyCode.Escape))
                CancelPlacement();
        }

        public void StartPlacement(BuildingData data)
        {
            if (_isPlacing) CancelPlacement();
            if (data?.Prefab == null) return;

            _pendingData = data;
            _ghost = Instantiate(data.Prefab);
            // Disable all colliders on ghost
            foreach (var c in _ghost.GetComponentsInChildren<Collider>())
                c.enabled = false;

            _isPlacing = true;
        }

        public void CancelPlacement()
        {
            if (_ghost != null) Destroy(_ghost);
            _pendingData = null;
            _isPlacing = false;
        }

        public bool IsValidPosition(Vector3 pos)
        {
            // Check overlap — no other buildings in radius
            var hits = Physics.OverlapSphere(pos, 2f);
            foreach (var h in hits)
            {
                if (h.GetComponent<BuildingBase>() != null) return false;
            }
            return true;
        }

        private void PlaceBuilding(Vector3 pos)
        {
            if (!ResourceManager.Instance.TrySpend(_pendingData.CrystalCost)) return;

            Destroy(_ghost);
            var building = Instantiate(_pendingData.Prefab, pos, Quaternion.identity);
            building.GetComponent<BuildingBase>()?.Initialize(_pendingData);
            _isPlacing = false;
        }

        private void SetGhostMaterial(Material mat)
        {
            if (mat == null) return;
            foreach (var r in _ghost.GetComponentsInChildren<Renderer>())
                r.material = mat;
        }
    }
}
