export interface PendingCaptainSummary {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  cpf: string | null;
  city: string | null;
  state: string;
  createdAt: Date;
  selfieUrl: string | null;
  licensePhotoUrl: string | null;
  certificatePhotoUrl: string | null;
  documentChangeRequests: unknown[];
}

export interface PendingVerificationsPayload {
  pendingBoats: Array<{
    id: string;
    name: string;
    type: string;
    registrationNum: string;
    documentPhotos: string[] | null;
    photos: string[] | null;
    rejectionReason: string | null;
    createdAt: Date;
    owner: {
      id: string;
      name: string;
      phone: string;
    } | null;
  }>;
  pendingCaptains: PendingCaptainSummary[];
  totalPending: number;
}

export interface AdminNotificationsPayload {
  totalUnread: number;
  sos: {
    count: number;
    items: Array<{
      id: string;
      type: string;
      description: string | null;
      location: string | null;
      userName: string;
      createdAt: Date;
      link: string;
    }>;
  };
  pendingVerifications: {
    count: number;
    boats: Array<{
      id: string;
      name: string;
      type: string;
      ownerName: string;
      createdAt: Date;
      link: string;
    }>;
    captains: Array<{
      id: string;
      name: string;
      phone: string;
      city: string | null;
      createdAt: Date;
      link: string;
    }>;
  };
  newTrips: {
    count: number;
    items: Array<{
      id: string;
      origin: string;
      destination: string;
      captainName: string;
      departureAt: Date;
      createdAt: Date;
      link: string;
    }>;
  };
}
