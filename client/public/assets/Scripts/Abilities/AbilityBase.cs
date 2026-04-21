using UnityEngine;
using LostCity.Data;

namespace LostCity.Abilities
{
    public abstract class AbilityBase : MonoBehaviour
    {
        [SerializeField] protected AbilityData _data;

        private float _cooldownTimer;

        public AbilityData Data => _data;
        public bool IsReady => _cooldownTimer <= 0f;
        public float CooldownProgress => _data != null ? Mathf.Clamp01(1f - _cooldownTimer / _data.Cooldown) : 1f;
        public float RemainingCooldown => _cooldownTimer;

        protected virtual void Update()
        {
            if (_cooldownTimer > 0f)
                _cooldownTimer -= Time.deltaTime;
        }

        public virtual bool TryActivate(Vector3 targetPoint)
        {
            if (!IsReady) return false;
            Activate(targetPoint);
            _cooldownTimer = _data != null ? _data.Cooldown : 15f;
            return true;
        }

        public virtual bool TryActivate(Core.IDamageable target)
        {
            if (!IsReady) return false;
            Activate(target);
            _cooldownTimer = _data != null ? _data.Cooldown : 15f;
            return true;
        }

        protected abstract void Activate(Vector3 targetPoint);

        protected virtual void Activate(Core.IDamageable target)
        {
            // Override for unit-targeted abilities
        }
    }
}
