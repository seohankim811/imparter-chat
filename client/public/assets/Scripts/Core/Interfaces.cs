using UnityEngine;

namespace LostCity.Core
{
    public enum Faction { ElfCouncil, Neverseen, Neutral }

    public interface IDamageable
    {
        float CurrentHealth { get; }
        float MaxHealth { get; }
        Faction Faction { get; }
        void TakeDamage(float amount);
    }

    public interface ISelectable
    {
        Transform Transform { get; }
        Faction Faction { get; }
        void OnSelected();
        void OnDeselected();
    }

    public interface IDebuffable
    {
        void ApplyDebuff(float damageReduction, float speedReduction, float duration);
    }

    public interface IProducer
    {
        void QueueUnit(Data.UnitData unitData);
    }
}
