using UnityEngine;
using UnityEngine.UI;
using LostCity.Core;

namespace LostCity.UI
{
    [RequireComponent(typeof(Canvas))]
    public class HealthBar : MonoBehaviour
    {
        [SerializeField] private Image _fillImage;
        [SerializeField] private Color _playerColor = Color.green;
        [SerializeField] private Color _enemyColor = Color.red;

        private IDamageable _target;
        private Transform _camTransform;

        public void Initialize(IDamageable target)
        {
            _target = target;
            _fillImage.color = target.Faction == Faction.ElfCouncil ? _playerColor : _enemyColor;
            _camTransform = Camera.main.transform;
        }

        private void LateUpdate()
        {
            if (_target == null) return;

            // Billboard — face camera
            transform.rotation = Quaternion.LookRotation(transform.position - _camTransform.position);

            float pct = _target.MaxHealth > 0f ? _target.CurrentHealth / _target.MaxHealth : 0f;
            _fillImage.fillAmount = pct;

            // Hide at full health
            gameObject.SetActive(pct < 0.999f);
        }
    }
}
