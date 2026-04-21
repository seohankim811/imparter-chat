using UnityEngine;
using LostCity.Core;

namespace LostCity.Units
{
    public class TelekineticProjectile : MonoBehaviour
    {
        [SerializeField] private float _speed = 12f;

        private IDamageable _target;
        private float _damage;
        private bool _initialized;

        public void Initialize(IDamageable target, float damage)
        {
            _target = target;
            _damage = damage;
            _initialized = true;
        }

        private void Update()
        {
            if (!_initialized) return;
            var targetMono = _target as MonoBehaviour;
            if (targetMono == null) { Destroy(gameObject); return; }

            Vector3 dir = (targetMono.transform.position - transform.position).normalized;
            transform.position += dir * _speed * Time.deltaTime;

            if (Vector3.Distance(transform.position, targetMono.transform.position) < 0.5f)
            {
                _target.TakeDamage(_damage);
                Destroy(gameObject);
            }
        }
    }
}
