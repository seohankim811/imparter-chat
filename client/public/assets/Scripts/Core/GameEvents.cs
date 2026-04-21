using UnityEngine;

namespace LostCity.Core
{
    public struct UnitDiedEvent
    {
        public Units.UnitBase Unit;
        public Faction Faction;
    }

    public struct BuildingDestroyedEvent
    {
        public Buildings.BuildingBase Building;
        public Faction Faction;
    }

    public struct SophieCapturedEvent { }

    public struct CouncilHallDestroyedEvent { }

    public struct NeverseenBaseDestroyedEvent { }

    public struct ResourceChangedEvent
    {
        public int NewAmount;
    }

    public struct UnitTrainedEvent
    {
        public Units.UnitBase Unit;
    }
}
