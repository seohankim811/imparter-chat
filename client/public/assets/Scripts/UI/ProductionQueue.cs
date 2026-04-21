using System.Collections.Generic;
using UnityEngine;
using UnityEngine.UI;
using LostCity.Buildings;
using LostCity.Core;

namespace LostCity.UI
{
    public class ProductionQueue : MonoBehaviour
    {
        [SerializeField] private Image _progressBar;
        [SerializeField] private Transform _queueContainer;
        [SerializeField] private GameObject _queueIconPrefab;

        private FoxfireAcademy _currentAcademy;

        private void Start()
        {
            SelectionManager.Instance.OnSelectionChanged += OnSelectionChanged;
            gameObject.SetActive(false);
        }

        private void OnDestroy()
        {
            if (SelectionManager.Instance != null)
                SelectionManager.Instance.OnSelectionChanged -= OnSelectionChanged;
        }

        private void OnSelectionChanged(List<ISelectable> selection)
        {
            _currentAcademy = null;
            if (selection.Count == 1 && selection[0] is FoxfireAcademy academy)
                _currentAcademy = academy;

            gameObject.SetActive(_currentAcademy != null);
            RefreshIcons();
        }

        private void RefreshIcons()
        {
            foreach (Transform child in _queueContainer)
                Destroy(child.gameObject);

            if (_currentAcademy == null) return;

            foreach (var unit in _currentAcademy.TrainingQueue)
            {
                var icon = Instantiate(_queueIconPrefab, _queueContainer);
                var img = icon.GetComponent<Image>();
                if (img != null && unit.Portrait != null)
                    img.sprite = unit.Portrait;
            }
        }

        private void Update()
        {
            if (_currentAcademy == null) return;
            // Progress bar would need production time tracking from FoxfireAcademy
            // For now just show training state
            if (_progressBar != null)
                _progressBar.gameObject.SetActive(_currentAcademy.IsTraining);
        }
    }
}
