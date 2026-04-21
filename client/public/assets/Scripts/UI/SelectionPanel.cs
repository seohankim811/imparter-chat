using System.Collections.Generic;
using UnityEngine;
using UnityEngine.UI;
using TMPro;
using LostCity.Core;
using LostCity.Units;

namespace LostCity.UI
{
    public class SelectionPanel : MonoBehaviour
    {
        [Header("Single Selection")]
        [SerializeField] private GameObject _singlePanel;
        [SerializeField] private Image _portrait;
        [SerializeField] private TextMeshProUGUI _unitName;
        [SerializeField] private Slider _healthSlider;
        [SerializeField] private AbilityButton[] _abilityButtons;

        [Header("Multi Selection")]
        [SerializeField] private GameObject _multiPanel;
        [SerializeField] private Image[] _multiPortraits;

        private void Start()
        {
            SelectionManager.Instance.OnSelectionChanged += OnSelectionChanged;
            _singlePanel.SetActive(false);
            _multiPanel.SetActive(false);
        }

        private void OnDestroy()
        {
            if (SelectionManager.Instance != null)
                SelectionManager.Instance.OnSelectionChanged -= OnSelectionChanged;
        }

        private void OnSelectionChanged(List<ISelectable> selection)
        {
            _singlePanel.SetActive(false);
            _multiPanel.SetActive(false);

            if (selection.Count == 0) return;

            if (selection.Count == 1)
            {
                ShowSingle(selection[0]);
            }
            else
            {
                ShowMulti(selection);
            }
        }

        private void ShowSingle(ISelectable selectable)
        {
            _singlePanel.SetActive(true);

            if (selectable is UnitBase unit)
            {
                _unitName.text = unit.Data?.UnitName ?? "유닛";
                if (_portrait != null && unit.Data?.Portrait != null)
                    _portrait.sprite = unit.Data.Portrait;
                if (_healthSlider != null)
                    _healthSlider.value = unit.MaxHealth > 0 ? unit.CurrentHealth / unit.MaxHealth : 0;
            }
            else if (selectable is Buildings.BuildingBase building)
            {
                _unitName.text = building.Data?.BuildingName ?? "건물";
                if (_healthSlider != null)
                    _healthSlider.value = building.MaxHealth > 0 ? building.CurrentHealth / building.MaxHealth : 0;
            }
        }

        private void ShowMulti(List<ISelectable> selection)
        {
            _multiPanel.SetActive(true);
            for (int i = 0; i < _multiPortraits.Length; i++)
            {
                if (i < selection.Count && selection[i] is UnitBase u && u.Data?.Portrait != null)
                {
                    _multiPortraits[i].gameObject.SetActive(true);
                    _multiPortraits[i].sprite = u.Data.Portrait;
                }
                else
                {
                    _multiPortraits[i].gameObject.SetActive(false);
                }
            }
        }

        private void Update()
        {
            // Keep health bar updated for single selection
            var sel = SelectionManager.Instance?.CurrentSelection;
            if (sel == null || sel.Count != 1 || !_singlePanel.activeSelf) return;
            if (sel[0] is UnitBase u && _healthSlider != null)
                _healthSlider.value = u.MaxHealth > 0 ? u.CurrentHealth / u.MaxHealth : 0;
        }
    }
}
