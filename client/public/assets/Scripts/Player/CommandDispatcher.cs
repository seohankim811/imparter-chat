using System.Collections.Generic;
using UnityEngine;
using LostCity.Core;
using LostCity.Units;

namespace LostCity.Player
{
    public class CommandDispatcher : MonoBehaviour
    {
        [SerializeField] private LayerMask _unitLayer;
        [SerializeField] private Camera _cam;

        private PlayerInputHandler _input;
        private SelectionManager _selection;

        private void Awake()
        {
            if (_cam == null) _cam = Camera.main;
        }

        private void Start()
        {
            _input = PlayerInputHandler.Instance;
            _selection = SelectionManager.Instance;

            _input.OnLeftClickHit += OnLeftClick;
            _input.OnRightClickWorld += OnRightClick;
            _input.OnBoxSelectEnd += OnBoxSelect;
            _input.OnAbilityKeyPressed += OnAbilityKey;
        }

        private void OnDestroy()
        {
            if (_input == null) return;
            _input.OnLeftClickHit -= OnLeftClick;
            _input.OnRightClickWorld -= OnRightClick;
            _input.OnBoxSelectEnd -= OnBoxSelect;
            _input.OnAbilityKeyPressed -= OnAbilityKey;
        }

        private void OnLeftClick(RaycastHit hit)
        {
            var selectable = hit.collider.GetComponent<ISelectable>();
            if (selectable != null && selectable.Faction == Faction.ElfCouncil)
            {
                if (Input.GetKey(KeyCode.LeftShift))
                    _selection.AddToSelection(selectable);
                else
                    _selection.Select(selectable);
            }
            else
            {
                _selection.ClearSelection();
            }
        }

        private void OnRightClick(Vector3 worldPos)
        {
            var units = GetSelectedUnits();
            if (units.Count == 0) return;

            // Check if clicking on an enemy
            Ray ray = _cam.ScreenPointToRay(Input.mousePosition);
            if (Physics.Raycast(ray, out RaycastHit hit, 500f, _unitLayer))
            {
                var damageable = hit.collider.GetComponent<IDamageable>();
                if (damageable != null && damageable.Faction == Faction.Neverseen)
                {
                    foreach (var u in units)
                        u.OrderAttack(damageable);
                    return;
                }
            }

            // Formation move — offset each unit slightly
            for (int i = 0; i < units.Count; i++)
            {
                Vector3 offset = new Vector3((i % 3) * 1.5f - 1.5f, 0, (i / 3) * -1.5f);
                units[i].MoveTo(worldPos + offset);
            }
        }

        private void OnBoxSelect(Rect screenRect)
        {
            var found = new List<ISelectable>();
            var allUnits = FindObjectsByType<UnitBase>(FindObjectsSortMode.None);
            foreach (var unit in allUnits)
            {
                if (unit.Faction != Faction.ElfCouncil) continue;
                Vector3 screenPos = _cam.WorldToScreenPoint(unit.transform.position);
                screenPos.y = Screen.height - screenPos.y;
                if (screenRect.Contains(screenPos))
                    found.Add(unit);
            }
            if (found.Count > 0)
                _selection.BoxSelect(found);
        }

        private void OnAbilityKey(int index)
        {
            var units = GetSelectedUnits();
            if (units.Count == 0) return;

            Ray ray = _cam.ScreenPointToRay(Input.mousePosition);
            if (!Physics.Raycast(ray, out RaycastHit hit, 500f)) return;

            foreach (var unit in units)
            {
                if (unit is SophieFoster sophie && index == 0)
                    sophie.UseTelepathy(sophie.transform.position);
                else if (unit is KeefeSencen keefe && index == 1)
                    keefe.UseEmotionSurge(hit.point);
            }
        }

        private List<UnitBase> GetSelectedUnits()
        {
            var result = new List<UnitBase>();
            foreach (var s in _selection.CurrentSelection)
                if (s is UnitBase u) result.Add(u);
            return result;
        }
    }
}
