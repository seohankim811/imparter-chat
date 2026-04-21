using UnityEngine;
using UnityEngine.UI;
using TMPro;
using LostCity.Abilities;

namespace LostCity.UI
{
    public class AbilityButton : MonoBehaviour
    {
        [SerializeField] private Image _iconImage;
        [SerializeField] private Image _cooldownOverlay;
        [SerializeField] private TextMeshProUGUI _hotkeyText;
        [SerializeField] private Button _button;

        private AbilityBase _ability;

        public void Bind(AbilityBase ability, string hotkey = "")
        {
            _ability = ability;
            if (ability?.Data?.Icon != null && _iconImage != null)
                _iconImage.sprite = ability.Data.Icon;
            if (_hotkeyText != null)
                _hotkeyText.text = hotkey;
            gameObject.SetActive(ability != null);
        }

        private void Update()
        {
            if (_ability == null || _cooldownOverlay == null) return;
            _cooldownOverlay.fillAmount = 1f - _ability.CooldownProgress;

            if (_button != null)
                _button.interactable = _ability.IsReady;
        }

        public void OnClick()
        {
            // Called from button's OnClick event in Inspector
            // Ability activation is handled via PlayerInputHandler hotkeys,
            // but this allows UI button clicks too
        }
    }
}
