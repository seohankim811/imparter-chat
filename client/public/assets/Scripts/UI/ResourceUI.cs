using UnityEngine;
using TMPro;
using LostCity.Core;

namespace LostCity.UI
{
    public class ResourceUI : MonoBehaviour
    {
        [SerializeField] private TextMeshProUGUI _crystalText;

        private void Start()
        {
            if (ResourceManager.Instance != null)
            {
                ResourceManager.Instance.OnCrystalsChanged += UpdateDisplay;
                UpdateDisplay(ResourceManager.Instance.CrystalBalance);
            }
        }

        private void OnDestroy()
        {
            if (ResourceManager.Instance != null)
                ResourceManager.Instance.OnCrystalsChanged -= UpdateDisplay;
        }

        private void UpdateDisplay(int amount)
        {
            if (_crystalText != null)
                _crystalText.text = $"엘리시안 결정: {amount}";
        }
    }
}
