import { Item } from "@/components/Item";
import { ItemGroup } from "@/components/ItemGroup";
import { ItemListStatic } from "@/components/ItemList";

const boldTitle = { fontFamily: "IBMPlexSans-SemiBold" as const };

export function EmailView() {
    return (
        <ItemListStatic>
            <ItemGroup title="Unread">
                <Item
                    title="Jordan Chen"
                    subtitle="Re: Deployment pipeline update"
                    detail="2m ago"
                    titleStyle={boldTitle}
                    showChevron={false}
                />
                <Item
                    title="GitHub"
                    subtitle="[daycare] PR #142 merged: feat(agents): add heartbeat monitor"
                    detail="18m ago"
                    titleStyle={boldTitle}
                    showChevron={false}
                />
                <Item
                    title="Sam Patel"
                    subtitle="Cost report for February ready for review"
                    detail="1h ago"
                    titleStyle={boldTitle}
                    showChevron={false}
                />
            </ItemGroup>
            <ItemGroup title="Earlier">
                <Item
                    title="Alex Rivera"
                    subtitle="Notes from standup — action items attached"
                    detail="Yesterday"
                    showChevron={false}
                />
                <Item
                    title="Vercel"
                    subtitle="Build succeeded: daycare-app@main (83040ac)"
                    detail="Yesterday"
                    showChevron={false}
                />
                <Item
                    title="Morgan Lee"
                    subtitle="Quick question about the cron scheduler API"
                    detail="Feb 26"
                    showChevron={false}
                />
                <Item title="Stripe" subtitle="Your February invoice is ready" detail="Feb 25" showChevron={false} />
                <Item
                    title="Chris Taylor"
                    subtitle="Re: Integration timeline for Q1"
                    detail="Feb 24"
                    showChevron={false}
                />
                <Item
                    title="GitHub"
                    subtitle="[daycare] Issue #98 closed: fix(agent): stabilize run_python"
                    detail="Feb 23"
                    showChevron={false}
                />
            </ItemGroup>
        </ItemListStatic>
    );
}
